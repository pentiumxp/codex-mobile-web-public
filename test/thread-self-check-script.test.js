"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
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
    assert.ok(report.summary.diagnosticCandidateCount >= 1);
    assert.ok(report.summary.diagnosticCandidates.some((candidate) => (
      candidate.category === "conversation_projection_mismatch"
        && candidate.diagnostic_type === "thread_detail_response_contract_mismatch"
        && candidate.error_code === "thread_detail_refresh_lost_user_input"
    )));
    assert.doesNotMatch(JSON.stringify(report.summary.diagnosticCandidates), /thread-a|thread-b|private|message|title/i);
    assert.equal(report.threadDetails[0].repeat.ok, true, "final read can recover while transient downgrade remains reported");
  } finally {
    global.fetch = originalFetch;
  }
});

test("thread self-check catches active turn assistant projection gap from raw rollout metadata", async () => {
  const originalFetch = global.fetch;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-self-check-"));
  const rolloutPath = path.join(tmpDir, "rollout.jsonl");
  const activeTurnId = "019f0e0b-bd22-7ac0-8217-e47190b935ff";
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({ type: "turn_context", payload: { turn_id: activeTurnId } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "private user text" }] } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "private assistant one" }] } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "private assistant two" }] } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "private assistant three" }] } }),
    "",
  ].join("\n"));

  const activeDetail = {
    thread: {
      id: "thread-active",
      activeTurnId,
      path: rolloutPath,
      turns: [{
        id: activeTurnId,
        status: "active",
        items: [
          { id: "u1", type: "userMessage" },
          { id: "a3", type: "agentMessage" },
        ],
      }],
    },
  };
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/api/public-config")) {
      return responseJson({ version: "0.1.11", clientBuildId: "test-build", shellCacheName: "test-cache", authRequired: true });
    }
    if (target.includes("/api/threads/thread-active")) {
      return responseJson(activeDetail);
    }
    if (target.includes("/api/threads")) {
      return responseJson({
        data: [{
          id: "thread-active",
          updatedAt: 1782624000000,
        }],
      });
    }
    throw new Error(`unexpected url: ${target}`);
  };

  try {
    const options = selfCheck.parseArgs([
      "--server", "http://127.0.0.1:8787",
      "--no-auth",
      "--sample-threads", "1",
      "--repeat", "1",
    ]);
    const report = await selfCheck.run(options, {});
    const codes = report.summary.issues.map((issue) => issue.code);

    assert.equal(report.ok, false);
    assert.ok(codes.includes("active_turn_assistant_projection_gap"));
    assert.ok(report.summary.diagnosticCandidates.some((candidate) => (
      candidate.category === "conversation_projection_mismatch"
        && candidate.diagnostic_type === "thread_detail_response_contract_mismatch"
        && candidate.error_code === "active_turn_assistant_projection_gap"
    )));
    assert.doesNotMatch(JSON.stringify(report.summary), /private assistant|private user|rollout\\.jsonl|thread-active/);
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("thread self-check accepts active assistant gaps explained by response budget", async () => {
  const originalFetch = global.fetch;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-self-check-"));
  const rolloutPath = path.join(tmpDir, "rollout.jsonl");
  const activeTurnId = "019f0e0b-bd22-7ac0-8217-e47190b935fa";
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({ type: "turn_context", payload: { turn_id: activeTurnId } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "private user text" }] } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "private assistant one" }] } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "private assistant two" }] } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "private assistant three" }] } }),
    "",
  ].join("\n"));

  const activeDetail = {
    thread: {
      id: "thread-active-budget",
      activeTurnId,
      path: rolloutPath,
      mobileDetailResponseBudget: {
        progressiveActiveBudgetApplied: true,
        activeOmittedAssistantItems: 1,
        progressiveReplayAssistantItems: 2,
        activeAssistantItemsAfter: 2,
      },
      turns: [{
        id: activeTurnId,
        status: "active",
        items: [
          { id: "u1", type: "userMessage" },
          { id: "a1", type: "agentMessage" },
          { id: "a2", type: "agentMessage" },
        ],
      }],
    },
  };
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/api/public-config")) {
      return responseJson({ version: "0.1.11", clientBuildId: "test-build", shellCacheName: "test-cache", authRequired: true });
    }
    if (target.includes("/api/threads/thread-active-budget")) {
      return responseJson(activeDetail);
    }
    if (target.includes("/api/threads")) {
      return responseJson({
        data: [{
          id: "thread-active-budget",
          name: "Active budget",
          preview: "Active budget",
          activeTurnId,
          path: rolloutPath,
          updatedAt: 1782624000000,
        }],
      });
    }
    throw new Error(`unexpected url: ${target}`);
  };

  try {
    const options = selfCheck.parseArgs([
      "--server", "http://127.0.0.1:8787",
      "--no-auth",
      "--sample-threads", "1",
      "--repeat", "1",
    ]);
    const report = await selfCheck.run(options, {});
    const activeProjection = report.threadDetails[0].activeTurnRawProjection;

    assert.equal(report.ok, true);
    assert.equal(activeProjection.ok, true);
    assert.equal(activeProjection.rawAssistantItems, 3);
    assert.equal(activeProjection.detailAssistantItems, 2);
    assert.equal(activeProjection.responseBudgetExplainsAssistantGap, true);
    assert.doesNotMatch(JSON.stringify(report.summary), /private assistant|private user|rollout\\.jsonl|thread-active-budget/);
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("thread self-check catches latest completed assistant projection gaps from raw rollout", async () => {
  const originalFetch = global.fetch;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-self-check-"));
  const rolloutPath = path.join(tmpDir, "rollout.jsonl");
  const completedTurnId = "019f0e0c-53ed-7390-91af-a2af89a8dc99";
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({ type: "turn_context", payload: { turn_id: completedTurnId } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "private user text" }] } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "private assistant one" }] } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "private assistant two" }] } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "private assistant three" }] } }),
    "",
  ].join("\n"));

  const detail = {
    thread: {
      id: "thread-latest-completed-gap",
      path: rolloutPath,
      turns: [{
        id: completedTurnId,
        status: "completed",
        items: [
          { id: "u1", type: "userMessage" },
          { id: "a1", type: "agentMessage" },
          { id: "usage1", type: "turnUsageSummary" },
        ],
      }],
    },
  };
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/api/public-config")) {
      return responseJson({ version: "0.1.11", clientBuildId: "test-build", shellCacheName: "test-cache", authRequired: true });
    }
    if (target.includes("/api/threads/thread-latest-completed-gap")) {
      return responseJson(detail);
    }
    if (target.includes("/api/threads")) {
      return responseJson({ data: [{ id: "thread-latest-completed-gap", name: "Gap", preview: "Gap", path: rolloutPath, updatedAt: 1782624000000 }] });
    }
    throw new Error(`unexpected url: ${target}`);
  };

  try {
    const options = selfCheck.parseArgs([
      "--server", "http://127.0.0.1:8787",
      "--no-auth",
      "--sample-threads", "1",
      "--repeat", "1",
    ]);
    const report = await selfCheck.run(options, {});
    const codes = report.summary.issues.map((issue) => issue.code);

    assert.equal(report.ok, false);
    assert.ok(codes.includes("latest_completed_assistant_projection_gap"));
    assert.equal(report.threadDetails[0].latestCompletedRawProjection.rawAssistantItems, 3);
    assert.equal(report.threadDetails[0].latestCompletedRawProjection.detailAssistantItems, 1);
    assert.doesNotMatch(JSON.stringify(report.summary), /private assistant|private user|rollout\\.jsonl|thread-latest-completed-gap/);
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("thread self-check compares active raw counts before detail to avoid growth races", async () => {
  const originalFetch = global.fetch;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-self-check-"));
  const rolloutPath = path.join(tmpDir, "rollout.jsonl");
  const activeTurnId = "019f0e0b-bd22-7ac0-8217-e47190b935ff";
  const initialLines = [
    JSON.stringify({ type: "turn_context", payload: { turn_id: activeTurnId } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "private user text" }] } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "private assistant one" }] } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "private assistant two" }] } }),
  ];
  fs.writeFileSync(rolloutPath, `${initialLines.join("\n")}\n`);

  const activeDetail = {
    thread: {
      id: "thread-active-growth",
      activeTurnId,
      path: rolloutPath,
      turns: [{
        id: activeTurnId,
        status: "active",
        items: [
          { id: "u1", type: "userMessage" },
          { id: "a1", type: "agentMessage" },
          { id: "a2", type: "agentMessage" },
        ],
      }],
    },
  };
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/api/public-config")) {
      return responseJson({ version: "0.1.11", clientBuildId: "test-build", shellCacheName: "test-cache", authRequired: true });
    }
    if (target.includes("/api/threads/thread-active-growth")) {
      fs.writeFileSync(rolloutPath, [
        ...initialLines,
        JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "private assistant three" }] } }),
        "",
      ].join("\n"));
      return responseJson(activeDetail);
    }
    if (target.includes("/api/threads")) {
      return responseJson({
        data: [{
          id: "thread-active-growth",
          name: "Active growth",
          preview: "Active growth",
          activeTurnId,
          path: rolloutPath,
          updatedAt: 1782624000000,
        }],
      });
    }
    throw new Error(`unexpected url: ${target}`);
  };

  try {
    const options = selfCheck.parseArgs([
      "--server", "http://127.0.0.1:8787",
      "--no-auth",
      "--sample-threads", "1",
      "--repeat", "1",
    ]);
    const report = await selfCheck.run(options, {});
    const activeProjection = report.threadDetails[0].activeTurnRawProjection;

    assert.equal(report.ok, true);
    assert.equal(activeProjection.ok, true);
    assert.equal(activeProjection.rawAssistantItems, 2);
    assert.equal(activeProjection.detailAssistantItems, 2);
    assert.doesNotMatch(JSON.stringify(report.summary), /private assistant|private user|rollout\\.jsonl|thread-active-growth/);
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("thread self-check suppresses completed input warning when raw turn has no user input", async () => {
  const originalFetch = global.fetch;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-self-check-"));
  const rolloutPath = path.join(tmpDir, "rollout.jsonl");
  const completedTurnId = "019f0e0c-5a51-7c71-9324-b4bc10010511";
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({ type: "turn_context", payload: { turn_id: completedTurnId } }),
    JSON.stringify({ type: "event_msg", payload: { type: "task_started" } }),
    JSON.stringify({ type: "event_msg", payload: { type: "patch_apply_end" } }),
    JSON.stringify({ type: "event_msg", payload: { type: "task_complete" } }),
    "",
  ].join("\n"));

  const detail = {
    thread: {
      id: "thread-system-complete",
      path: rolloutPath,
      turns: [{
        id: completedTurnId,
        status: "completed",
        items: [
          { id: "a1", type: "agentMessage" },
          { id: "usage1", type: "turnUsageSummary" },
        ],
      }],
    },
  };
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/api/public-config")) {
      return responseJson({ version: "0.1.11", clientBuildId: "test-build", shellCacheName: "test-cache", authRequired: true });
    }
    if (target.includes("/api/threads/thread-system-complete")) {
      return responseJson(detail);
    }
    if (target.includes("/api/threads")) {
      return responseJson({ data: [{ id: "thread-system-complete", name: "System complete", preview: "System complete", updatedAt: 1782624000000 }] });
    }
    throw new Error(`unexpected url: ${target}`);
  };

  try {
    const options = selfCheck.parseArgs([
      "--server", "http://127.0.0.1:8787",
      "--no-auth",
      "--sample-threads", "1",
      "--repeat", "2",
      "--repeat-delay-ms", "1",
    ]);
    const report = await selfCheck.run(options, {});
    const codes = report.summary.issues.map((issue) => issue.code);

    assert.equal(report.ok, true);
    assert.ok(!codes.includes("latest_completed_user_input_missing"));
    assert.equal(report.threadDetails[0].first.suppressedIssues[0].code, "latest_completed_user_input_missing");
    assert.equal(report.threadDetails[0].first.rawLatestCompletedInputEvidence.rawUserItems, 0);
    assert.doesNotMatch(JSON.stringify(report), /rollout\.jsonl|thread-system-complete/);
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("thread self-check keeps completed input warning when raw turn has user input", async () => {
  const originalFetch = global.fetch;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-self-check-"));
  const rolloutPath = path.join(tmpDir, "rollout.jsonl");
  const completedTurnId = "019f0e0c-a89e-7382-8251-0f58aac5df12";
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({ type: "turn_context", payload: { turn_id: completedTurnId } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "private user text" }] } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "private assistant text" }] } }),
    "",
  ].join("\n"));

  const detail = {
    thread: {
      id: "thread-real-gap",
      path: rolloutPath,
      turns: [{
        id: completedTurnId,
        status: "completed",
        items: [
          { id: "a1", type: "agentMessage" },
          { id: "usage1", type: "turnUsageSummary" },
        ],
      }],
    },
  };
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/api/public-config")) {
      return responseJson({ version: "0.1.11", clientBuildId: "test-build", shellCacheName: "test-cache", authRequired: true });
    }
    if (target.includes("/api/threads/thread-real-gap")) {
      return responseJson(detail);
    }
    if (target.includes("/api/threads")) {
      return responseJson({ data: [{ id: "thread-real-gap", name: "Real gap", preview: "Real gap", updatedAt: 1782624000000 }] });
    }
    throw new Error(`unexpected url: ${target}`);
  };

  try {
    const options = selfCheck.parseArgs([
      "--server", "http://127.0.0.1:8787",
      "--no-auth",
      "--sample-threads", "1",
      "--repeat", "2",
      "--repeat-delay-ms", "1",
    ]);
    const report = await selfCheck.run(options, {});
    const codes = report.summary.issues.map((issue) => issue.code);

    assert.equal(report.ok, true);
    assert.ok(codes.includes("latest_completed_user_input_missing"));
    assert.ok(report.summary.diagnosticCandidates.some((candidate) => (
      candidate.error_code === "latest_completed_user_input_missing"
    )));
    assert.doesNotMatch(JSON.stringify(report.summary), /private user|private assistant|rollout\.jsonl|thread-real-gap/);
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
