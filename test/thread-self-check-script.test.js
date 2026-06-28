"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const selfCheck = require("../scripts/codex-mobile-thread-self-check");

function responseJson(value) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(value),
  };
}

function healthyDetail() {
  return {
    thread: {
      id: "thread-a",
      updatedAt: 1782624000000,
      turns: [
        {
          id: "019f0ca6-a9c9-7753-8224-416f754b6c03",
          status: "completed",
          items: [
            { id: "u1", type: "userMessage" },
            { id: "a1", type: "agentMessage" },
            { id: "a2", type: "agentMessage" },
            { id: "usage1", type: "turnUsageSummary" },
          ],
        },
      ],
    },
  };
}

function degradedDetail() {
  return {
    thread: {
      id: "thread-a",
      updatedAt: 1782624000000,
      turns: [
        {
          id: "019f0ca6-a9c9-7753-8224-416f754b6c03",
          status: "completed",
          items: [
            { id: "a1", type: "agentMessage" },
            { id: "usage1", type: "turnUsageSummary" },
          ],
        },
      ],
    },
  };
}

test("thread self-check repeat catches transient list and detail downgrade", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  const listResponses = [
    { data: [{ id: "thread-a", updatedAt: 3000 }, { id: "thread-b", updatedAt: 2000 }] },
    { data: [{ id: "thread-a", updatedAt: 1000 }] },
    { data: [{ id: "thread-a", updatedAt: 3000 }, { id: "thread-b", updatedAt: 2000 }] },
  ];
  const detailResponses = [healthyDetail(), degradedDetail(), healthyDetail()];
  global.fetch = async (url) => {
    calls.push(String(url));
    const target = String(url);
    if (target.includes("/api/public-config")) {
      return responseJson({ version: "0.1.11", clientBuildId: "test-build", shellCacheName: "test-cache", authRequired: true });
    }
    if (target.includes("/api/threads/thread-a")) {
      return responseJson(detailResponses.shift() || healthyDetail());
    }
    if (target.includes("/api/threads")) {
      return responseJson(listResponses.shift() || listResponses.at(-1));
    }
    throw new Error(`unexpected url: ${target}`);
  };
  try {
    const options = selfCheck.parseArgs([
      "--server", "http://127.0.0.1:8787",
      "--no-auth",
      "--sample-threads", "1",
      "--repeat", "3",
      "--repeat-delay-ms", "1",
    ]);
    const report = await selfCheck.run(options, {});
    const codes = report.summary.issues.map((issue) => issue.code);

    assert.equal(calls.filter((url) => url.includes("/api/threads/thread-a")).length, 3);
    assert.equal(report.ok, false);
    assert.ok(codes.includes("thread_list_repeat_lost_thread_ids"));
    assert.ok(codes.includes("thread_detail_refresh_lost_user_input"));
    assert.ok(codes.includes("thread_detail_refresh_lost_assistant_items"));
    assert.equal(report.threadDetails[0].repeat.ok, true, "final read can recover while transient downgrade remains reported");
  } finally {
    global.fetch = originalFetch;
  }
});
