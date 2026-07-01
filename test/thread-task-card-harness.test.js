"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const { normalizeCreateRequest } = require("../services/task-cards/thread-task-card-service");

function sampleCreateRequest(overrides = {}) {
  return Object.assign({
    sourceWorkspaceId: "finance",
    sourceThreadId: "thread_src",
    sourceTurnId: "turn_src",
    targetWorkspaceId: "ops",
    targetThreadId: "thread_dst",
    idempotencyKey: "finance:thread_src:turn_src:1",
    format: "markdown",
    title: "Need verification",
    summary: "Please verify this mapping.",
    body: "Detailed request.",
  }, overrides);
}

function sampleTaskCard(overrides = {}) {
  const request = sampleCreateRequest();
  return Object.assign({
    id: "ttc_01",
    status: "pending",
    source: {
      workspaceId: request.sourceWorkspaceId,
      threadId: request.sourceThreadId,
      turnId: request.sourceTurnId,
      title: "Finance / close check",
    },
    target: {
      workspaceId: request.targetWorkspaceId,
      threadId: request.targetThreadId,
    },
    message: {
      format: request.format,
      title: request.title,
      summary: request.summary,
      body: request.body,
    },
    delivery: {
      injectOnApprove: true,
      allowReply: true,
      allowRevoke: true,
    },
  }, overrides);
}

function applyAction(card, action, actor) {
  const current = JSON.parse(JSON.stringify(card));
  if (current.status !== "pending") throw new Error(`card_not_pending:${current.status}`);
  if (action === "approve") {
    if (actor !== "target") throw new Error("approve_requires_target_actor");
    current.status = "approved";
    if (current.workflow && current.workflow.mode === "autonomous") {
      current.workflow.authorized = true;
    }
    current.injectedMessage = {
      type: "userMessage",
      text: `[跨线程待办已批准导入]\n\n来源工作区：${current.source.workspaceId}\n来源线程：${current.source.title}\n\n${current.message.body}`,
      bridgeSource: {
        cardId: current.id,
        workspaceId: current.source.workspaceId,
        threadId: current.source.threadId,
        turnId: current.source.turnId,
      },
    };
    return current;
  }
  if (action === "delete") {
    if (actor !== "target") throw new Error("delete_requires_target_actor");
    current.status = "deleted";
    return current;
  }
  if (action === "revoke") {
    if (actor !== "source") throw new Error("revoke_requires_source_actor");
    current.status = "revoked";
    return current;
  }
  if (action === "reply") {
    if (actor !== "target") throw new Error("reply_requires_target_actor");
    current.status = "replied";
    current.replyCard = {
      source: {
        workspaceId: current.target.workspaceId,
        threadId: current.target.threadId,
      },
      target: {
        workspaceId: current.source.workspaceId,
        threadId: current.source.threadId,
      },
      message: {
        format: "markdown",
        title: `Reply: ${current.message.title}`,
      },
    };
    return current;
  }
  throw new Error(`unknown_action:${action}`);
}

function canAutoApproveInWorkflow(card, workflow) {
  if (!card || !workflow) return false;
  if (card.status !== "pending") return false;
  if (!card.workflow || card.workflow.mode !== "autonomous" || !card.workflow.id) return false;
  const cardThreadIds = [card.source.threadId, card.target.threadId].sort();
  const workflowThreadIds = Array.isArray(workflow.threadIds) ? workflow.threadIds.slice().sort() : [];
  return workflow.status === "active"
    && workflow.mode === "autonomous"
    && workflow.id === card.workflow.id
    && cardThreadIds[0] === workflowThreadIds[0]
    && cardThreadIds[1] === workflowThreadIds[1];
}

test("task-card create request stays bounded and separate from message flow", () => {
  const request = sampleCreateRequest();
  assert.equal(request.format, "markdown");
  assert.ok(request.title.length <= 120);
  assert.ok(request.summary.length <= 300);
  assert.ok(request.body.length <= 8000);
  assert.doesNotMatch(JSON.stringify(request), /userMessage|turn\/steer|activeTurnId/);
});

test("task-card create request rejects likely encoding-damaged visible text", () => {
  assert.throws(
    () => normalizeCreateRequest(sampleCreateRequest({
      title: "?? Hermes ?????? v133",
      summary: "?????? Hermes ?????????",
      body: "????????????????????????????????",
    })),
    /task_card_text_encoding_damaged:title/,
  );
});

test("target approval injects a real message only after approval", () => {
  const next = applyAction(sampleTaskCard(), "approve", "target");
  assert.equal(next.status, "approved");
  assert.equal(next.injectedMessage.type, "userMessage");
  assert.match(next.injectedMessage.text, /\[跨线程待办已批准导入\]/);
  assert.equal(next.injectedMessage.bridgeSource.cardId, "ttc_01");
});

test("target approval leaves pending state before external turn injection settles", () => {
  const approving = sampleTaskCard({
    status: "approving",
    audit: {
      createdAt: "2026-05-29T00:00:00Z",
      approvingAt: "2026-05-29T00:01:00Z",
    },
  });
  assert.throws(() => applyAction(approving, "approve", "target"), /card_not_pending:approving/);
});

test("autonomous workflow still requires first target approval before later same-pair auto-run", () => {
  const first = sampleTaskCard({
    workflow: {
      mode: "autonomous",
      id: "workflow-1",
      authorized: false,
    },
  });
  assert.equal(canAutoApproveInWorkflow(first, null), false);
  const approved = applyAction(first, "approve", "target");
  assert.equal(approved.workflow.authorized, true);
  const activeWorkflow = {
    id: "workflow-1",
    mode: "autonomous",
    status: "active",
    threadIds: ["thread_src", "thread_dst"],
  };
  assert.equal(canAutoApproveInWorkflow(sampleTaskCard({
    workflow: {
      mode: "autonomous",
      id: "workflow-1",
      authorized: false,
    },
  }), activeWorkflow), true);
  assert.equal(canAutoApproveInWorkflow(sampleTaskCard({
    target: {
      workspaceId: "ops",
      threadId: "thread_other",
    },
    workflow: {
      mode: "autonomous",
      id: "workflow-1",
      authorized: false,
    },
  }), activeWorkflow), false);
});

test("target delete removes the pending card without injection", () => {
  const next = applyAction(sampleTaskCard(), "delete", "target");
  assert.equal(next.status, "deleted");
  assert.equal(Object.prototype.hasOwnProperty.call(next, "injectedMessage"), false);
});

test("source revoke is allowed only while pending", () => {
  const next = applyAction(sampleTaskCard(), "revoke", "source");
  assert.equal(next.status, "revoked");
  assert.throws(() => applyAction(next, "approve", "target"), /card_not_pending/);
});

test("reply creates a reverse-direction controlled card", () => {
  const next = applyAction(sampleTaskCard(), "reply", "target");
  assert.equal(next.status, "replied");
  assert.equal(next.replyCard.source.workspaceId, "ops");
  assert.equal(next.replyCard.target.workspaceId, "finance");
  assert.match(next.replyCard.message.title, /^Reply:/);
});
