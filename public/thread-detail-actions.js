"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexThreadDetailActions = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  function withinRoot(root, node) {
    if (!root || !node || typeof root.contains !== "function") return true;
    return root.contains(node);
  }

  function closestWithin(target, selector, root = null) {
    if (!target || typeof target.closest !== "function") return null;
    const node = target.closest(selector);
    if (!node || !withinRoot(root, node)) return null;
    return node;
  }

  function action(type, target, fields = {}) {
    return Object.assign({
      action: String(type || "none"),
      target: target || null,
      preventDefault: false,
      stopPropagation: false,
    }, fields);
  }

  function dataValue(node, key) {
    return String(node && node.dataset && node.dataset[key] || "");
  }

  function contextThreadIdFromNode(node, explicitDatasetKey = "") {
    if (!node) return "";
    const explicit = explicitDatasetKey ? dataValue(node, explicitDatasetKey) : "";
    if (explicit) return explicit;
    if (typeof node.closest !== "function") return "";
    const pane = node.closest("[data-thread-tile-pane]");
    return dataValue(pane, "threadTilePane");
  }

  function previewableImageFromTarget(target, root = null) {
    const image = closestWithin(
      target,
      ".input-image img, .image-view img, .markdown-image img, .file-preview-image, .attachment-thumb",
      root,
    );
    if (!image) return null;
    if (image.closest && image.closest(".github-link-card")) return null;
    return image;
  }

  function resolveRichContentClickAction(input = {}) {
    const target = input.target || null;
    const root = input.root || null;
    let node = closestWithin(target, "[data-copy-key]", root);
    if (node) return action("copy", node, { button: node, preventDefault: true, stopPropagation: true });
    node = closestWithin(target, "[data-local-file-path]", root);
    if (node) return action("local-file-preview", node, {
      link: node,
      threadId: contextThreadIdFromNode(node, "localFileThreadId"),
      preventDefault: true,
      stopPropagation: true,
    });
    node = closestWithin(target, "[data-mermaid-action]", root);
    if (node) return action("mermaid", node, { button: node, preventDefault: true, stopPropagation: true });
    node = closestWithin(target, "[data-github-link-preview-expand]", root);
    if (node) return action("github-preview-toggle", node, { button: node, preventDefault: true, stopPropagation: true });
    return action("none", null, { reason: "no-match" });
  }

  function resolveThreadDetailClickAction(input = {}) {
    const target = input.target || null;
    const root = input.root || null;
    const rich = resolveRichContentClickAction({ target, root });
    if (rich.action !== "none") return rich;
    let node = closestWithin(target, "[data-approval-action]", root);
    if (node) {
      return action("approval-answer", node, {
        button: node,
        approvalId: dataValue(node, "approvalId"),
        approvalAction: dataValue(node, "approvalAction"),
        threadId: dataValue(node, "approvalThreadId"),
      });
    }
    node = closestWithin(target, "[data-task-card-action]", root);
    if (node) {
      const taskCardAction = dataValue(node, "taskCardAction");
      const cardId = dataValue(node, "taskCardId");
      const threadId = dataValue(node, "taskCardThreadId");
      if (taskCardAction === "reply") {
        return action("task-card-reply", node, { button: node, cardId, taskCardAction, threadId });
      }
      if (taskCardAction === "approve" || taskCardAction === "delete" || taskCardAction === "revoke") {
        return action("task-card-mutate", node, { button: node, cardId, taskCardAction, threadId });
      }
      return action("task-card-unknown", node, { button: node, cardId, taskCardAction, threadId });
    }
    node = closestWithin(target, "[data-task-card-draft-action]", root);
    if (node) {
      return action("task-card-draft", node, {
        button: node,
        draftAction: dataValue(node, "taskCardDraftAction"),
        draftKey: dataValue(node, "taskCardDraftKey"),
      });
    }
    node = closestWithin(target, "[data-server-response-text]", root);
    if (node) {
      return action("server-response", node, {
        option: node,
        requestId: dataValue(node, "serverRequestId"),
        threadId: dataValue(node, "serverRequestThreadId"),
        responseText: dataValue(node, "serverResponseText"),
        questionId: dataValue(node, "serverQuestionId") || "answer",
      });
    }
    node = closestWithin(target, "[data-server-request-decline]", root);
    if (node) {
      return action("server-request-decline", node, {
        button: node,
        requestId: dataValue(node, "serverRequestId"),
        threadId: dataValue(node, "serverRequestThreadId"),
      });
    }
    return action("none", null, { reason: "no-match" });
  }

  return {
    closestWithin,
    previewableImageFromTarget,
    resolveRichContentClickAction,
    resolveThreadDetailClickAction,
    contextThreadIdFromNode,
  };
}));
