"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadListResponseCoalescer,
  defaultThreadListCoalescingKey,
} = require("../adapters/thread-list-response-coalescer-service");

test("thread-list response coalescer keys only default full-list requests", () => {
  assert.ok(defaultThreadListCoalescingKey({ limit: 40 }));
  assert.equal(defaultThreadListCoalescingKey({ limit: 40, cursor: "cursor" }), "");
  assert.equal(defaultThreadListCoalescingKey({ limit: 40, archived: true }), "");
  assert.equal(defaultThreadListCoalescingKey({ limit: 40, cwd: "/private/workspace" }), "");
  assert.equal(defaultThreadListCoalescingKey({ limit: 40, searchTerm: "private query" }), "");
  assert.equal(defaultThreadListCoalescingKey({ limit: 40, fallbackMode: "defer" }), "");
  assert.equal(defaultThreadListCoalescingKey({ limit: 40, initialMode: "warm-fallback" }), "");
  assert.doesNotMatch(defaultThreadListCoalescingKey({ limit: 40 }), /private|query|workspace/);
});

test("thread-list response coalescer shares one leader result with followers", async () => {
  let now = 1000;
  const coalescer = createThreadListResponseCoalescer({ nowMs: () => now });
  const leader = coalescer.begin({ limit: 40 });
  const follower = coalescer.begin({ limit: 40 });

  assert.equal(leader.enabled, true);
  assert.equal(leader.leader, true);
  assert.equal(follower.enabled, true);
  assert.equal(follower.leader, false);
  assert.equal(coalescer.size(), 1);

  const followerResultPromise = follower.result();
  now = 1225;
  leader.complete({
    data: [{ id: "thread-1", name: "private title must stay in data only" }],
    mobileDiagnostics: {
      threadListTimings: {
        totalMs: 480,
        appServerRpcMs: 25,
      },
    },
  });

  const followerResult = await followerResultPromise;
  assert.equal(coalescer.size(), 0);
  assert.deepEqual(followerResult.data, [{ id: "thread-1", name: "private title must stay in data only" }]);
  assert.equal(followerResult.mobileDiagnostics.threadListTimings.threadListCoalescedRequest, true);
  assert.equal(followerResult.mobileDiagnostics.threadListTimings.threadListCoalescedWaitMs, 225);
  assert.equal(followerResult.mobileDiagnostics.threadListTimings.threadListCoalescedLeaderTotalMs, 480);
  assert.match(followerResult.mobileDiagnostics.threadListTimings.threadListCoalescedKeyHash, /^[a-z0-9]+$/);

  followerResult.data[0].name = "mutated";
  const secondLeader = coalescer.begin({ limit: 40 });
  assert.equal(secondLeader.leader, true);
  secondLeader.complete({ data: [{ id: "thread-2" }] });
});

test("thread-list response coalescer does not copy private request fields into diagnostics", async () => {
  let now = 0;
  const coalescer = createThreadListResponseCoalescer({ nowMs: () => now });
  const leader = coalescer.begin({ limit: 40 });
  const follower = coalescer.begin({ limit: 40 });
  const followerResultPromise = follower.result();

  now = 15;
  leader.complete({
    data: [{ id: "thread-1" }],
    mobileDiagnostics: {
      threadListTimings: {
        totalMs: 12,
      },
    },
  });

  const followerResult = await followerResultPromise;
  const diagnosticText = JSON.stringify(followerResult.mobileDiagnostics.threadListTimings);
  assert.doesNotMatch(diagnosticText, /Users|session\.jsonl|prompt|privatePrompt|workspace|query/);
});

test("thread-list response coalescer releases failed leaders", async () => {
  const coalescer = createThreadListResponseCoalescer();
  const leader = coalescer.begin({ limit: 40 });
  const follower = coalescer.begin({ limit: 40 });
  const followerResultPromise = follower.result();

  leader.fail(new Error("app server failed"));
  await assert.rejects(followerResultPromise, /app server failed/);
  assert.equal(coalescer.size(), 0);

  const next = coalescer.begin({ limit: 40 });
  assert.equal(next.leader, true);
  next.complete({ data: [] });
});
