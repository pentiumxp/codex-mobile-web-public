"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const actions = require(path.resolve(__dirname, "..", "public", "thread-detail-actions.js"));

const IMAGE_SELECTOR = ".input-image img, .image-view img, .markdown-image img, .file-preview-image, .attachment-thumb";

function node(name, dataset = {}) {
  return {
    name,
    dataset,
    closest() {
      return null;
    },
  };
}

function targetWith(matches = {}) {
  return {
    closest(selector) {
      return matches[selector] || null;
    },
  };
}

function rootContaining(...nodes) {
  const allowed = new Set(nodes);
  return {
    contains(candidate) {
      return allowed.has(candidate);
    },
  };
}

test("previewable image target excludes GitHub link cards", () => {
  const image = node("image");
  const target = targetWith({ [IMAGE_SELECTOR]: image });
  assert.equal(actions.previewableImageFromTarget(target), image);

  const githubImage = node("github-image");
  githubImage.closest = (selector) => selector === ".github-link-card" ? node("github-card") : null;
  const githubTarget = targetWith({ [IMAGE_SELECTOR]: githubImage });
  assert.equal(actions.previewableImageFromTarget(githubTarget), null);
});

test("rich content click action preserves selector priority and event modifiers", () => {
  const copy = node("copy", { copyKey: "copy-1" });
  const local = node("file", { localFilePath: "/tmp/a.md" });
  const plan = actions.resolveRichContentClickAction({
    target: targetWith({
      "[data-copy-key]": copy,
      "[data-local-file-path]": local,
    }),
  });

  assert.equal(plan.action, "copy");
  assert.equal(plan.button, copy);
  assert.equal(plan.preventDefault, true);
  assert.equal(plan.stopPropagation, true);
});

test("click action rejects nodes outside the supplied root", () => {
  const copy = node("copy", { copyKey: "copy-1" });
  const plan = actions.resolveRichContentClickAction({
    root: rootContaining(),
    target: targetWith({ "[data-copy-key]": copy }),
  });

  assert.equal(plan.action, "none");
  assert.equal(plan.reason, "no-match");
});

test("thread detail click action resolves approval and task card controls", () => {
  const approval = node("approval", { approvalId: "ap-1", approvalAction: "allow_once" });
  assert.deepEqual(actions.resolveThreadDetailClickAction({
    target: targetWith({ "[data-approval-action]": approval }),
  }), {
    action: "approval-answer",
    target: approval,
    preventDefault: false,
    stopPropagation: false,
    button: approval,
    approvalId: "ap-1",
    approvalAction: "allow_once",
  });

  const reply = node("reply", { taskCardAction: "reply", taskCardId: "ttc_1", taskCardThreadId: "thread-a" });
  const replyPlan = actions.resolveThreadDetailClickAction({
    target: targetWith({ "[data-task-card-action]": reply }),
  });
  assert.equal(replyPlan.action, "task-card-reply");
  assert.equal(replyPlan.threadId, "thread-a");

  const approve = node("approve", { taskCardAction: "approve", taskCardId: "ttc_2", taskCardThreadId: "thread-b" });
  const approvePlan = actions.resolveThreadDetailClickAction({
    target: targetWith({ "[data-task-card-action]": approve }),
  });
  assert.equal(approvePlan.action, "task-card-mutate");
  assert.equal(approvePlan.taskCardAction, "approve");
  assert.equal(approvePlan.cardId, "ttc_2");
  assert.equal(approvePlan.threadId, "thread-b");
});

test("thread detail click action resolves draft and server response controls", () => {
  const draft = node("draft", { taskCardDraftAction: "dismiss", taskCardDraftKey: "draft-1" });
  const draftPlan = actions.resolveThreadDetailClickAction({
    target: targetWith({ "[data-task-card-draft-action]": draft }),
  });
  assert.equal(draftPlan.action, "task-card-draft");
  assert.equal(draftPlan.draftAction, "dismiss");
  assert.equal(draftPlan.draftKey, "draft-1");

  const response = node("response", {
    serverRequestId: "req-1",
    serverResponseText: "yes",
    serverQuestionId: "answer",
  });
  const responsePlan = actions.resolveThreadDetailClickAction({
    target: targetWith({ "[data-server-response-text]": response }),
  });
  assert.equal(responsePlan.action, "server-response");
  assert.equal(responsePlan.requestId, "req-1");
  assert.equal(responsePlan.responseText, "yes");

  const decline = node("decline", { serverRequestId: "req-2" });
  const declinePlan = actions.resolveThreadDetailClickAction({
    target: targetWith({ "[data-server-request-decline]": decline }),
  });
  assert.equal(declinePlan.action, "server-request-decline");
  assert.equal(declinePlan.requestId, "req-2");
});
