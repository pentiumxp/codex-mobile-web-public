"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createThreadSummaryReadModelService,
} = require("../services/thread-list/thread-summary-read-model-service");

function createService(overrides = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "thread-summary-read-model-"));
  const codexHome = overrides.codexHome || tmpDir;
  const writes = [];
  const readJsonFile = overrides.readJsonFile || ((file, fallback) => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (_) {
      return fallback;
    }
  });
  const writeRuntimeJson = overrides.writeRuntimeJson || ((file, value) => {
    writes.push({ file, value });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  });
  const service = createThreadSummaryReadModelService(Object.assign({
    fs,
    path,
    codexHome,
    maxStartThreadDeveloperInstructionsChars: 500,
    startedThreadCacheTtlMs: 1000,
    startedThreadCacheMax: 2,
    readRpcTimeoutMs: 1234,
    readJsonFile,
    writeRuntimeJson,
    annotateThreadRolloutStats: (thread) => Object.assign({}, thread, { annotated: true }),
    upsertThreadListFallbackCacheThread: () => true,
    normalizeStaleContextOnlyActiveThread: (thread) => thread && Object.assign({}, thread, { normalized: true }),
    threadDisplaySummaryCache: {
      remember: (thread) => thread && Object.assign({}, thread, { remembered: true }),
    },
    isRecoverableThreadListTitle: (value, id) => String(value || "") === `# ${id}`,
    requestThreadTitleUpdate: async () => true,
    logger: false,
  }, overrides));
  return { service, tmpDir, writes };
}

test("thread-summary read model compatibility adapter re-exports canonical factory", () => {
  const adapter = require("../adapters/thread-summary-read-model-service");
  assert.equal(adapter.createThreadSummaryReadModelService, createThreadSummaryReadModelService);
});

test("thread-summary read model owns projectless thread ids in global state", () => {
  const { service, tmpDir, writes } = createService();
  assert.equal(service.readGlobalState()["projectless-thread-ids"], undefined);

  assert.equal(service.rememberProjectlessThreadId("thread-1"), true);
  assert.equal(service.rememberProjectlessThreadId("thread-1"), false);
  assert.deepEqual(service.readGlobalState()["projectless-thread-ids"], ["thread-1"]);
  assert.equal(writes[writes.length - 1].file, path.join(tmpDir, ".codex-global-state.json"));
});

test("thread-summary read model reads AGENTS.md chain for start-thread developer instructions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "thread-summary-agents-"));
  const nested = path.join(root, "a", "b");
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(root, "AGENTS.md"), "root instructions\n");
  fs.writeFileSync(path.join(root, "a", "AGENTS.md"), "a instructions\n");
  const { service } = createService({ maxStartThreadDeveloperInstructionsChars: 1000 });

  assert.deepEqual(service.agentInstructionFilesForCwd(nested), [
    path.join(root, "AGENTS.md"),
    path.join(root, "a", "AGENTS.md"),
  ]);
  const text = service.readStartThreadDeveloperInstructions(nested);
  assert.match(text, /# Instructions from .*AGENTS\.md/);
  assert.ok(text.indexOf("root instructions") < text.indexOf("a instructions"));
});

test("thread-summary read model owns recent started-thread cache", () => {
  const cache = new Map();
  const upserts = [];
  let nowMs = 10_000;
  const { service } = createService({
    recentStartedThreads: cache,
    startedThreadCacheTtlMs: 100,
    startedThreadCacheMax: 2,
    now: () => nowMs,
    upsertThreadListFallbackCacheThread: (thread, options) => upserts.push({ thread, options }),
  });

  assert.equal(service.rememberStartedThread({ id: "a", name: "A" }).annotated, true);
  assert.equal(service.readStartedThread("a").name, "A");
  assert.equal(upserts[0].options.addIfMissing, true);

  nowMs += 50;
  service.rememberStartedThread({ id: "b" });
  nowMs += 50;
  service.rememberStartedThread({ id: "c" });
  assert.equal(cache.has("a"), false, "oldest entry should be pruned by max size");
  assert.equal(cache.has("b"), true);
  assert.equal(cache.has("c"), true);

  nowMs += 200;
  assert.equal(service.readStartedThread("b"), null, "expired entries should be pruned");
});

test("thread-summary read model reads app-server summary through display cache", async () => {
  const requests = [];
  const { service } = createService();
  const codexClient = {
    async request(method, params, options) {
      requests.push({ method, params, options });
      return { data: [{ id: "other" }, { id: "thread-1", name: "From app-server" }] };
    },
  };

  const summary = await service.readThreadSummaryFromAppServer(codexClient, "thread-1");
  assert.equal(summary.name, "From app-server");
  assert.equal(summary.remembered, true);
  assert.equal(summary.normalized, true);
  assert.equal(requests[0].method, "thread/list");
  assert.equal(requests[0].options.timeoutMs, 1234);
});

test("thread-summary read model owns title update fallback and display-title normalization", async () => {
  const attempts = [];
  const { service } = createService({
    requestThreadTitleUpdate: async (method, params, options) => {
      attempts.push({ method, params, options });
      if (attempts.length < 3) throw new Error("method not found");
      return true;
    },
  });

  assert.equal(await service.tryUpdateThreadTitle("thread-1", "Title"), true);
  assert.deepEqual(attempts.map((entry) => entry.method), [
    "thread/name/set",
    "thread/updateTitle",
    "thread/update_title",
  ]);
  assert.equal(attempts[0].options.timeoutMs, 1234);

  assert.equal(service.threadDisplayTitle({
    id: "thread-1",
    name: "# thread-1",
    preview: "Fallback title",
  }), "Fallback title");
  assert.equal(service.truncateSingleLine(" a \n b \t c ", 20), "a b c");
  assert.equal(service.isRecoverableThreadTitleUpdateError(new Error("database disk image is malformed")), true);
});
