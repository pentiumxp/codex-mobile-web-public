"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const domPatch = require(path.resolve(__dirname, "..", "public", "thread-detail-dom-patch.js"));
const patchPlan = require(path.resolve(__dirname, "..", "public", "thread-detail-patch-plan.js"));
const renderPlan = require(path.resolve(__dirname, "..", "public", "thread-detail-render-plan.js"));

function unlinkNode(node) {
  if (!node || !node.parentNode) return;
  const parent = node.parentNode;
  const index = parent.childNodes.indexOf(node);
  if (index >= 0) parent.childNodes.splice(index, 1);
  node.parentNode = null;
  node.nextSibling = null;
  syncSiblings(parent);
}

function syncSiblings(parent) {
  (parent.childNodes || []).forEach((child, index, list) => {
    child.parentNode = parent;
    child.nextSibling = list[index + 1] || null;
  });
}

function createTextNode(value) {
  return {
    nodeType: 3,
    nodeValue: String(value || ""),
    parentNode: null,
    nextSibling: null,
    cloneNode() {
      return createTextNode(this.nodeValue);
    },
    remove() {
      unlinkNode(this);
    },
    replaceWith(replacement) {
      replaceNode(this, replacement);
    },
  };
}

function replaceNode(target, replacement) {
  const parent = target && target.parentNode;
  if (!parent) return;
  const index = parent.childNodes.indexOf(target);
  if (index < 0) return;
  unlinkNode(replacement);
  parent.childNodes[index] = replacement;
  target.parentNode = null;
  target.nextSibling = null;
  syncSiblings(parent);
}

function createElement(tagName, attrs = {}, children = []) {
  const attrMap = new Map(Object.entries(attrs).map(([key, value]) => [key, String(value)]));
  const node = {
    nodeType: 1,
    tagName: String(tagName || "div").toUpperCase(),
    childNodes: [],
    parentNode: null,
    nextSibling: null,
    get firstChild() {
      return this.childNodes[0] || null;
    },
    get attributes() {
      return Array.from(attrMap.entries()).map(([name, value]) => ({ name, value }));
    },
    getAttribute(name) {
      return attrMap.has(name) ? attrMap.get(name) : null;
    },
    setAttribute(name, value) {
      attrMap.set(name, String(value));
    },
    removeAttribute(name) {
      attrMap.delete(name);
    },
    insertBefore(child, anchor) {
      unlinkNode(child);
      const anchorIndex = anchor ? this.childNodes.indexOf(anchor) : -1;
      if (anchorIndex >= 0) this.childNodes.splice(anchorIndex, 0, child);
      else this.childNodes.push(child);
      syncSiblings(this);
    },
    cloneNode(deep) {
      return createElement(
        this.tagName,
        Object.fromEntries(attrMap.entries()),
        deep ? this.childNodes.map((child) => child.cloneNode(true)) : [],
      );
    },
    querySelector(selector) {
      const match = String(selector || "").match(/^\[data-render-key="([^"]+)"\]$/);
      if (!match) return null;
      return findByRenderKey(this, match[1]);
    },
    remove() {
      unlinkNode(this);
    },
    replaceWith(replacement) {
      replaceNode(this, replacement);
    },
  };
  children.forEach((child) => node.insertBefore(child, null));
  return node;
}

function findByRenderKey(root, key) {
  if (!root) return null;
  if (root.nodeType === 1 && root.getAttribute("data-render-key") === key) return root;
  for (const child of root.childNodes || []) {
    const found = findByRenderKey(child, key);
    if (found) return found;
  }
  return null;
}

function itemText(node) {
  return node && node.childNodes && node.childNodes[0] ? node.childNodes[0].nodeValue : "";
}

function visibleItemKeys(node) {
  return Array.from(node && node.childNodes || [])
    .filter((child) => child && child.getAttribute && child.getAttribute("data-item") != null)
    .map((child) => child.getAttribute("data-render-key"));
}

function reducePatchEffects(effects, runner) {
  let aggregate = renderPlan.emptyThreadDetailRefreshPatchAttempt();
  for (const effect of effects) {
    const context = renderPlan.threadDetailRefreshPatchAttemptEffectContext({}, aggregate);
    const attempt = runner(effect, context);
    aggregate = renderPlan.reduceThreadDetailRefreshPatchAttempt(aggregate, attempt);
  }
  return aggregate;
}

function renderOutcomeFromPatchAttempt(patchAttempt, options = {}) {
  const refreshRenderPlan = renderPlan.planThreadDetailRefreshRender({
    previousConversationSignature: "sig-a",
    nextConversationSignature: "sig-b",
    renderedConversationSignature: "sig-a",
    previousPatchShellSignature: "shell-a",
    renderedPatchShellSignature: "shell-a",
    allowPatch: true,
  });
  const patchAttemptResult = renderPlan.planThreadDetailRefreshPatchAttemptResult({
    shouldRenderDetail: refreshRenderPlan.shouldRenderDetail,
    tilePanePatchAttempted: patchAttempt.tilePanePatchAttempted,
    tilePanePatchedDetail: patchAttempt.tilePanePatchedDetail,
    localPatchAttempted: patchAttempt.localPatchAttempted,
    locallyPatchedDetail: patchAttempt.locallyPatchedDetail,
    tilePanePatchMs: patchAttempt.tilePanePatchMs,
    localPatchMs: patchAttempt.localPatchMs,
    patchRejectReason: patchAttempt.patchRejectReason,
  });
  return Object.assign({
    refreshRenderPlan,
    patchAttemptResult,
    renderOutcome: renderPlan.finalizeThreadDetailRenderPlan(
      refreshRenderPlan,
      patchAttemptResult.finalizeResult,
    ),
  }, options);
}

test("refresh DOM harness treats tile patch success as terminal", () => {
  const patchExecution = renderPlan.planThreadDetailRefreshPatchExecution({
    shouldRenderDetail: true,
    canPatch: true,
    tileSurfaceRefresh: true,
  });
  const effectPlan = renderPlan.planThreadDetailRefreshPatchAttemptEffects({
    shouldRenderDetail: true,
    tryTilePanePatch: patchExecution.tryTilePanePatch,
    tryLocalPatch: patchExecution.tryLocalPatch,
  });
  const calls = [];
  const patchAttempt = reducePatchEffects(effectPlan.effects, (effect, context) => {
    calls.push(effect.type);
    if (effect.type === "local-patch") {
      assert.equal(context.tilePanePatchedDetail, true);
      assert.equal(effect.skipWhenTilePanePatched, true);
      return {
        localPatchAttempted: false,
        locallyPatchedDetail: false,
        localPatchMs: 0,
      };
    }
    assert.equal(effect.type, "tile-pane-patch");
    return {
      tilePanePatchAttempted: true,
      tilePanePatchedDetail: true,
      tilePanePatchMs: 4,
    };
  });
  const result = renderOutcomeFromPatchAttempt(patchAttempt);

  assert.deepEqual(calls, ["tile-pane-patch", "local-patch"]);
  assert.equal(patchAttempt.localPatchAttempted, false);
  assert.equal(result.patchAttemptResult.patchResult, "tile-pane-patched");
  assert.equal(result.renderOutcome.renderAction, "tile-pane-patch");
  assert.equal(result.renderOutcome.tilePanePatchedDetail, true);
  assert.equal(renderPlan.planThreadDetailRefreshOutcomeExecution(result.renderOutcome).executionAction, "none");
});

function runSingleThreadLocalPatchTransaction() {
  const article = createElement("article", { "data-render-key": "turn-a" }, [
    createElement("div", { "data-render-key": "item-agent" }, [createTextNode("old")]),
  ]);
  const conversation = createElement("div", {}, [article]);
  const itemPatchPlan = patchPlan.planVisibleItemRefreshPatch(
    [{ key: "item-agent", signature: { type: "agentMessage", text: "old" } }],
    [{ key: "item-agent", signature: { type: "agentMessage", text: "new" } }],
  );
  const turnPatchPlan = patchPlan.planThreadDetailRefreshDomPatch([
    {
      key: "turn-a",
      hasPreviousTurn: true,
      itemPatchable: itemPatchPlan.canPatch,
      articlePresent: true,
    },
  ]);
  const calls = [];
  const transaction = domPatch.applyThreadDetailPatchTransaction({
    applyPatch: () => domPatch.applyThreadTurnRefreshDomPatch({
      patchPlan: turnPatchPlan,
      conversation,
      findTurnByKey: () => ({ id: "turn-a" }),
      findTurnElementByKey: () => article,
      firstTurnElement: () => article,
      applyItemPatch: () => domPatch.applyVisibleItemRefreshDomPatch({
        article,
        patchPlan: itemPatchPlan,
        findElementByKey: (key) => article.querySelector(`[data-render-key="${key}"]`),
        renderElement: (entry) => createElement(
          "div",
          { "data-render-key": entry.key },
          [createTextNode(entry.signature.text)],
        ),
        patchElement: (target, entry) => domPatch.patchNode(
          target,
          createElement("div", { "data-render-key": entry.key }, [createTextNode(entry.signature.text)]),
        ),
      }),
      renderTurnElement: () => createElement("article", { "data-render-key": "turn-a" }),
      insertTurnElement: () => ({ ok: true }),
      replaceTurnElement: () => ({ ok: true, target: article }),
    }),
    commitEffects: [
      {
        name: "complete-local-conversation-dom-update",
        apply: () => {
          calls.push("complete");
          return { ok: true };
        },
      },
    ],
    afterSuccess: [
      {
        name: "update-live-operation-dock",
        apply: () => {
          calls.push("dock");
          return { ok: true };
        },
      },
    ],
  });
  return { article, calls, transaction };
}

test("refresh DOM harness commits single-thread local patch before dock update", () => {
  const effectPlan = renderPlan.planThreadDetailRefreshPatchAttemptEffects({
    shouldRenderDetail: true,
    tryTilePanePatch: true,
    tryLocalPatch: true,
  });
  const localPatch = runSingleThreadLocalPatchTransaction();
  const patchAttempt = reducePatchEffects(effectPlan.effects, (effect, context) => {
    if (effect.type === "tile-pane-patch") {
      return {
        tilePanePatchAttempted: true,
        tilePanePatchedDetail: false,
        tilePanePatchMs: 1,
      };
    }
    assert.equal(effect.type, "local-patch");
    assert.equal(context.tilePanePatchedDetail, false);
    return {
      localPatchAttempted: true,
      locallyPatchedDetail: localPatch.transaction.ok,
      localPatchMs: 3,
      patchRejectReason: localPatch.transaction.ok ? "" : localPatch.transaction.reason,
    };
  });
  const result = renderOutcomeFromPatchAttempt(patchAttempt);

  assert.equal(localPatch.transaction.ok, true);
  assert.equal(itemText(localPatch.article.childNodes[0]), "new");
  assert.deepEqual(localPatch.calls, ["complete", "dock"]);
  assert.equal(localPatch.transaction.commitEffectsApplied, 1);
  assert.equal(localPatch.transaction.postCommitEffectsApplied, 1);
  assert.equal(result.patchAttemptResult.patchResult, "local-patched");
  assert.equal(result.renderOutcome.renderAction, "local-patch-metadata-update");
  assert.equal(renderPlan.planThreadDetailRefreshOutcomeExecution(result.renderOutcome).executionAction, "metadata-effects");
});

test("visible item refresh DOM patch removes stale duplicate render-key nodes", () => {
  const article = createElement("article", { "data-render-key": "turn-a" }, [
    createElement("div", { "data-render-key": "item-user", "data-item": "1" }, [createTextNode("user")]),
    createElement("div", { "data-render-key": "item-user", "data-item": "1" }, [createTextNode("stale-user")]),
    createElement("div", { "data-render-key": "item-agent", "data-item": "1" }, [createTextNode("old")]),
  ]);
  const itemPatchPlan = patchPlan.planVisibleItemRefreshPatch(
    [
      { key: "item-user", signature: { type: "userMessage", text: "user" } },
      { key: "item-agent", signature: { type: "agentMessage", text: "old" } },
    ],
    [
      { key: "item-user", signature: { type: "userMessage", text: "user" } },
      { key: "item-agent", signature: { type: "agentMessage", text: "new" } },
      { key: "item-usage", signature: { type: "turnUsageSummary", total: 10 } },
    ],
  );
  const result = domPatch.applyVisibleItemRefreshDomPatch({
    article,
    patchPlan: itemPatchPlan,
    findElementByKey: (key) => article.querySelector(`[data-render-key="${key}"]`),
    renderElement: (entry) => createElement(
      "div",
      { "data-render-key": entry.key, "data-item": "1" },
      [createTextNode(entry.signature.text || "usage")],
    ),
    patchElement: (target, entry) => domPatch.patchNode(
      target,
      createElement(
        "div",
        { "data-render-key": entry.key, "data-item": "1" },
        [createTextNode(entry.signature.text || "usage")],
      ),
    ),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(visibleItemKeys(article), ["item-user", "item-agent", "item-usage"]);
  assert.equal(article.childNodes.filter((child) => child.getAttribute("data-render-key") === "item-user").length, 1);
  assert.equal(itemText(article.childNodes[1]), "new");
});

test("refresh DOM harness routes local patch rejection to full render", () => {
  const effectPlan = renderPlan.planThreadDetailRefreshPatchAttemptEffects({
    shouldRenderDetail: true,
    tryTilePanePatch: true,
    tryLocalPatch: true,
  });
  const patchAttempt = reducePatchEffects(effectPlan.effects, (effect) => {
    if (effect.type === "tile-pane-patch") {
      return {
        tilePanePatchAttempted: true,
        tilePanePatchedDetail: false,
        tilePanePatchMs: 1,
      };
    }
    assert.equal(effect.type, "local-patch");
    return {
      localPatchAttempted: true,
      locallyPatchedDetail: false,
      localPatchMs: 2,
      patchRejectReason: "missing-existing-node",
    };
  });
  const result = renderOutcomeFromPatchAttempt(patchAttempt);
  const execution = renderPlan.planThreadDetailRefreshOutcomeExecution(result.renderOutcome);

  assert.equal(result.patchAttemptResult.patchResult, "local-patch-rejected");
  assert.equal(result.patchAttemptResult.patchRejectReason, "missing-existing-node");
  assert.equal(result.patchAttemptResult.reportLocalPatchRejected, true);
  assert.equal(result.renderOutcome.renderAction, "full-render");
  assert.equal(result.renderOutcome.locallyPatchedDetail, false);
  assert.equal(execution.executionAction, "full-render");
  assert.equal(execution.consistencyCheck.phase, "refresh-full-render");
});
