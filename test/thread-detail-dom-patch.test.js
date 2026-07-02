"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const domPatch = require(path.resolve(__dirname, "..", "public", "thread-detail-dom-patch.js"));

test("thread detail patch result returns bounded structured status", () => {
  assert.deepEqual(domPatch.threadDetailPatchResult(true, "patched"), {
    ok: true,
    reason: "patched",
    reused: 0,
    patched: 0,
    inserted: 0,
  });

  const rejected = domPatch.threadDetailPatchResult(false, "x".repeat(120));
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason.length, 80);
  assert.equal(rejected.reused, 0);
  assert.equal(rejected.patched, 0);
  assert.equal(rejected.inserted, 0);
});

function createNode(key) {
  return { key: String(key || ""), nextSibling: null };
}

function syncSiblings(nodes) {
  nodes.forEach((node, index) => {
    node.nextSibling = nodes[index + 1] || null;
  });
}

function createArticle(nodes) {
  const article = {
    nodes: nodes.slice(),
    get firstChild() {
      return this.nodes[0] || null;
    },
    insertBefore(node, anchor) {
      const existingIndex = this.nodes.indexOf(node);
      if (existingIndex >= 0) this.nodes.splice(existingIndex, 1);
      const anchorIndex = anchor ? this.nodes.indexOf(anchor) : -1;
      if (anchorIndex >= 0) this.nodes.splice(anchorIndex, 0, node);
      else this.nodes.push(node);
      syncSiblings(this.nodes);
    },
  };
  syncSiblings(article.nodes);
  return article;
}

function unlinkDomNode(node) {
  if (!node || !node.parentNode) return;
  const parent = node.parentNode;
  const index = parent.childNodes.indexOf(node);
  if (index >= 0) parent.childNodes.splice(index, 1);
  node.parentNode = null;
  node.nextSibling = null;
  syncDomSiblings(parent);
}

function syncDomSiblings(parent) {
  (parent.childNodes || []).forEach((child, index, list) => {
    child.parentNode = parent;
    child.nextSibling = list[index + 1] || null;
  });
}

function domNodeBase() {
  return {
    parentNode: null,
    nextSibling: null,
    remove() {
      unlinkDomNode(this);
    },
    replaceWith(replacement) {
      const parent = this.parentNode;
      if (!parent) return;
      const index = parent.childNodes.indexOf(this);
      if (index < 0) return;
      unlinkDomNode(replacement);
      parent.childNodes[index] = replacement;
      this.parentNode = null;
      this.nextSibling = null;
      syncDomSiblings(parent);
    },
  };
}

function createDomText(value) {
  return Object.assign(domNodeBase(), {
    nodeType: 3,
    nodeValue: String(value || ""),
    cloneNode() {
      return createDomText(this.nodeValue);
    },
  });
}

function createDomElement(tagName, attrs = {}, children = []) {
  const attrMap = new Map(Object.entries(attrs).map(([key, value]) => [key, String(value)]));
  const node = Object.assign(domNodeBase(), {
    nodeType: 1,
    tagName: String(tagName || "div").toUpperCase(),
    childNodes: [],
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
      unlinkDomNode(child);
      const anchorIndex = anchor ? this.childNodes.indexOf(anchor) : -1;
      if (anchorIndex >= 0) this.childNodes.splice(anchorIndex, 0, child);
      else this.childNodes.push(child);
      syncDomSiblings(this);
    },
    cloneNode(deep) {
      return createDomElement(
        this.tagName,
        Object.fromEntries(attrMap.entries()),
        deep ? this.childNodes.map((child) => child.cloneNode(true)) : [],
      );
    },
  });
  Object.defineProperty(node, "firstChild", {
    enumerable: true,
    get() {
      return this.childNodes[0] || null;
    },
  });
  Object.defineProperty(node, "attributes", {
    enumerable: true,
    get() {
      return Array.from(attrMap.entries()).map(([name, value]) => ({ name, value }));
    },
  });
  children.forEach((child) => node.insertBefore(child, null));
  return node;
}

function childText(node) {
  return node && node.childNodes && node.childNodes[0] ? node.childNodes[0].nodeValue : "";
}

function createPatchHtmlDocument(childrenFactory) {
  return {
    createElement(tagName) {
      if (tagName !== "template") return null;
      return {
        content: createDomElement("fragment"),
        set innerHTML(value) {
          this.content = createDomElement("fragment", {}, childrenFactory(String(value || "")));
        },
      };
    },
  };
}

function createTemplateDocument(options = {}) {
  return {
    createElement(tagName) {
      if (options.throwOnCreate) throw new Error("create failed");
      if (tagName !== "template") return null;
      return {
        content: { firstElementChild: null },
        set innerHTML(value) {
          const html = String(value || "");
          if (!html.trim()) {
            this.content.firstElementChild = null;
            return;
          }
          const key = (html.match(/data-render-key="([^"]+)"/) || [])[1] || "created";
          const node = createNode(key);
          node.html = html;
          this.content.firstElementChild = node;
        },
      };
    },
  };
}

test("keyed DOM patching reorders keyed nodes", () => {
  const keyedA = createDomElement("div", { "data-render-key": "a" }, [createDomText("old a")]);
  const keyedB = createDomElement("div", { "data-render-key": "b" }, [createDomText("old b")]);
  const target = createDomElement("section", {}, [keyedA, keyedB]);
  const source = createDomElement("fragment", {}, [
    createDomElement("div", { "data-render-key": "b" }, [createDomText("new b")]),
    createDomElement("div", { "data-render-key": "a" }, [createDomText("new a")]),
  ]);

  domPatch.patchChildNodes(target, source);

  assert.equal(target.childNodes[0], keyedB);
  assert.equal(target.childNodes[1], keyedA);
  assert.equal(childText(keyedB), "new b");
  assert.equal(childText(keyedA), "new a");
});

test("DOM patching reuses compatible unkeyed cursor nodes and removes stale nodes", () => {
  const unkeyed = createDomElement("p", {}, [createDomText("old unkeyed")]);
  const keyed = createDomElement("div", { "data-render-key": "keep", class: "old" }, [createDomText("old keyed")]);
  const stale = createDomElement("div", { "data-render-key": "stale" }, [createDomText("stale")]);
  const target = createDomElement("section", {}, [keyed, unkeyed, stale]);
  const source = createDomElement("fragment", {}, [
    createDomElement("div", { "data-render-key": "keep", class: "new" }, [createDomText("new keyed")]),
    createDomElement("p", {}, [createDomText("new unkeyed")]),
    createDomElement("div", { "data-render-key": "inserted" }, [createDomText("inserted")]),
  ]);

  domPatch.patchChildNodes(target, source);

  assert.equal(target.childNodes[0], keyed);
  assert.equal(keyed.getAttribute("class"), "new");
  assert.equal(childText(keyed), "new keyed");
  assert.equal(target.childNodes[1], unkeyed);
  assert.equal(childText(unkeyed), "new unkeyed");
  assert.equal(target.childNodes[2].getAttribute("data-render-key"), "inserted");
  assert.equal(childText(target.childNodes[2]), "inserted");
  assert.equal(stale.parentNode, null);
});

test("DOM patching replaces incompatible nodes and returns the replacement", () => {
  const oldNode = createDomElement("span", { id: "old" }, [createDomText("old")]);
  const parent = createDomElement("section", {}, [oldNode]);
  const source = createDomElement("div", { id: "new" }, [createDomText("new")]);

  const replacement = domPatch.patchNode(oldNode, source);

  assert.notEqual(replacement, oldNode);
  assert.equal(parent.childNodes[0], replacement);
  assert.equal(replacement.tagName, "DIV");
  assert.equal(replacement.getAttribute("id"), "new");
  assert.equal(childText(replacement), "new");
  assert.equal(oldNode.parentNode, null);
});

test("patchHtml parses through an injected document and returns bounded failures", () => {
  const target = createDomElement("section", {}, [
    createDomElement("div", { "data-render-key": "old" }, [createDomText("old")]),
  ]);
  const document = createPatchHtmlDocument(() => [
    createDomElement("div", { "data-render-key": "new" }, [createDomText("new")]),
  ]);

  const result = domPatch.patchHtml({ target, html: "<div>new</div>", document });

  assert.equal(result.ok, true);
  assert.equal(result.reason, "patched");
  assert.equal(result.target, target);
  assert.deepEqual(target.childNodes.map((node) => node.getAttribute("data-render-key")), ["new"]);
  assert.equal(childText(target.childNodes[0]), "new");
  assert.equal(domPatch.patchHtml({ html: "<div></div>", document }).reason, "missing-target");
  assert.equal(domPatch.patchHtml({ target, html: "<div></div>" }).reason, "missing-document");
});

test("conversation HTML update plan preserves stable signatures without repainting", () => {
  assert.deepEqual(domPatch.planConversationHtmlUpdate({
    signature: "sig-a",
    renderedConversationSignature: "sig-a",
    renderedConversationPatchShellSignature: "shell-old",
    patchShellSignature: "",
    stickToBottom: false,
    hasExistingChildren: true,
  }), {
    action: "hydrate-existing",
    changed: false,
    stableSignature: true,
    reason: "signature-stable",
    signature: "sig-a",
    patchShellSignature: "",
    updateRenderedConversationSignature: false,
    updatePatchShellSignature: false,
    nextRenderedConversationSignature: "sig-a",
    nextRenderedConversationPatchShellSignature: "shell-old",
    hydrateOptions: {
      imageScanDelays: [0, 180],
      skipRichHydration: true,
    },
    scrollAction: "update-bottom-button",
    performance: false,
  });

  const withPatchShell = domPatch.planConversationHtmlUpdate({
    signature: "sig-a",
    renderedConversationSignature: "sig-a",
    renderedConversationPatchShellSignature: "shell-old",
    patchShellSignature: "shell-new",
    stickToBottom: true,
  });
  assert.equal(withPatchShell.action, "hydrate-existing");
  assert.equal(withPatchShell.updatePatchShellSignature, true);
  assert.equal(withPatchShell.nextRenderedConversationPatchShellSignature, "shell-new");
  assert.equal(withPatchShell.scrollAction, "scroll-to-bottom");
});

test("conversation HTML update plan selects patch or innerHTML for changed signatures", () => {
  assert.deepEqual(domPatch.planConversationHtmlUpdate({
    signature: "sig-next",
    renderedConversationSignature: "sig-old",
    patchShellSignature: "shell-next",
    stickToBottom: true,
    hasExistingChildren: true,
  }), {
    action: "patch-html",
    fallbackAction: "set-inner-html",
    changed: true,
    stableSignature: false,
    reason: "signature-changed",
    signature: "sig-next",
    patchShellSignature: "shell-next",
    updateRenderedConversationSignature: true,
    updatePatchShellSignature: true,
    nextRenderedConversationSignature: "sig-next",
    nextRenderedConversationPatchShellSignature: "shell-next",
    hydrateOptions: {},
    scrollAction: "scroll-to-bottom",
    performance: true,
  });

  const emptyTargetPlan = domPatch.planConversationHtmlUpdate({
    signature: "sig-next",
    renderedConversationSignature: "",
    hasExistingChildren: false,
  });
  assert.equal(emptyTargetPlan.action, "set-inner-html");
  assert.equal(emptyTargetPlan.scrollAction, "update-bottom-button");
});

test("conversation HTML update plan invalidates stable signatures when visible turns are missing from DOM", () => {
  const plan = domPatch.planConversationHtmlUpdate({
    signature: "sig-a",
    renderedConversationSignature: "sig-a",
    renderedConversationPatchShellSignature: "shell-old",
    patchShellSignature: "shell-new",
    stickToBottom: true,
    hasExistingChildren: true,
    expectedVisibleTurnCount: 3,
    renderedDomTurnCount: 0,
  });

  assert.equal(plan.action, "set-inner-html");
  assert.equal(plan.changed, true);
  assert.equal(plan.stableSignature, true);
  assert.equal(plan.reason, "stable-signature-dom-empty");
  assert.equal(plan.updateRenderedConversationSignature, true);
  assert.equal(plan.updatePatchShellSignature, true);
  assert.equal(plan.nextRenderedConversationSignature, "sig-a");
  assert.equal(plan.nextRenderedConversationPatchShellSignature, "shell-new");

  const partialPlan = domPatch.planConversationHtmlUpdate({
    signature: "sig-a",
    renderedConversationSignature: "sig-a",
    hasExistingChildren: true,
    expectedVisibleTurnCount: 3,
    renderedDomTurnCount: 2,
  });
  assert.equal(partialPlan.action, "set-inner-html");
  assert.equal(partialPlan.reason, "stable-signature-dom-turn-mismatch");

  const healthyPlan = domPatch.planConversationHtmlUpdate({
    signature: "sig-a",
    renderedConversationSignature: "sig-a",
    expectedVisibleTurnCount: 3,
    renderedDomTurnCount: 3,
  });
  assert.equal(healthyPlan.action, "hydrate-existing");
  assert.equal(healthyPlan.reason, "signature-stable");
});

test("conversation HTML update plan invalidates stable signatures for item/key/order mismatches", () => {
  const itemMismatch = domPatch.planConversationHtmlUpdate({
    signature: "sig-a",
    renderedConversationSignature: "sig-a",
    expectedVisibleTurnCount: 2,
    renderedDomTurnCount: 2,
    expectedVisibleItemCount: 5,
    renderedDomItemCount: 4,
  });
  assert.equal(itemMismatch.action, "set-inner-html");
  assert.equal(itemMismatch.reason, "stable-signature-dom-item-mismatch");

  const duplicateKeys = domPatch.planConversationHtmlUpdate({
    signature: "sig-a",
    renderedConversationSignature: "sig-a",
    expectedVisibleTurnCount: 2,
    renderedDomTurnCount: 2,
    duplicateRenderKeyCount: 1,
  });
  assert.equal(duplicateKeys.action, "set-inner-html");
  assert.equal(duplicateKeys.reason, "stable-signature-duplicate-render-keys");

  const duplicateUserMessages = domPatch.planConversationHtmlUpdate({
    signature: "sig-a",
    renderedConversationSignature: "sig-a",
    expectedVisibleTurnCount: 2,
    renderedDomTurnCount: 2,
    duplicateUserMessageCount: 2,
    expectedDuplicateUserMessageCount: 1,
  });
  assert.equal(duplicateUserMessages.action, "set-inner-html");
  assert.equal(duplicateUserMessages.reason, "stable-signature-duplicate-user-messages");

  const expectedDuplicateUserMessages = domPatch.planConversationHtmlUpdate({
    signature: "sig-a",
    renderedConversationSignature: "sig-a",
    expectedVisibleTurnCount: 2,
    renderedDomTurnCount: 2,
    duplicateUserMessageCount: 1,
    expectedDuplicateUserMessageCount: 1,
  });
  assert.equal(expectedDuplicateUserMessages.action, "hydrate-existing");
  assert.equal(expectedDuplicateUserMessages.reason, "signature-stable");

  const orderMismatch = domPatch.planConversationHtmlUpdate({
    signature: "sig-a",
    renderedConversationSignature: "sig-a",
    expectedVisibleTurnCount: 2,
    renderedDomTurnCount: 2,
    expectedTurnIds: ["a", "b"],
    renderedDomTurnIds: ["b", "a"],
  });
  assert.equal(orderMismatch.action, "set-inner-html");
  assert.equal(orderMismatch.reason, "stable-signature-turn-order-mismatch");
});

test("conversation HTML update effects preserve hydrate-existing ordering", () => {
  const updatePlan = domPatch.planConversationHtmlUpdate({
    signature: "sig-a",
    renderedConversationSignature: "sig-a",
    renderedConversationPatchShellSignature: "shell-old",
    patchShellSignature: "shell-next",
    stickToBottom: true,
    hasExistingChildren: true,
  });

  assert.deepEqual(domPatch.planConversationHtmlUpdateEffects(updatePlan), {
    effects: [
      {
        type: "set-rendered-conversation-patch-shell-signature",
        value: "shell-next",
      },
      {
        type: "hydrate-root",
        hydrateOptions: {
          imageScanDelays: [0, 180],
          skipRichHydration: true,
        },
      },
      {
        type: "schedule-conversation-to-bottom",
      },
    ],
    reason: "hydrate-existing-effects",
  });
});

test("conversation HTML update effects preserve changed-render ordering", () => {
  const updatePlan = domPatch.planConversationHtmlUpdate({
    signature: "sig-next",
    renderedConversationSignature: "sig-old",
    patchShellSignature: "shell-next",
    stickToBottom: false,
    hasExistingChildren: true,
  });

  assert.deepEqual(domPatch.planConversationHtmlUpdateEffects(updatePlan), {
    effects: [
      {
        type: "hydrate-root",
        hydrateOptions: {},
      },
      {
        type: "set-rendered-conversation-signature",
        value: "sig-next",
      },
      {
        type: "set-rendered-conversation-patch-shell-signature",
        value: "shell-next",
      },
      {
        type: "schedule-scroll-button-update",
      },
    ],
    reason: "conversation-update-effects",
  });
});

test("conversation HTML update effects ignore missing or unknown actions", () => {
  assert.deepEqual(domPatch.planConversationHtmlUpdateEffects({}), {
    effects: [],
    reason: "missing-action",
  });
  assert.deepEqual(domPatch.planConversationHtmlUpdateEffects({ action: "unknown", scrollAction: "scroll-to-bottom" }), {
    effects: [],
    reason: "unknown-action",
  });
});

test("conversation DOM authority invalidation is planned from stable empty DOM mismatches", () => {
  const plan = domPatch.planConversationDomAuthorityInvalidation({
    updatePlan: {
      action: "set-inner-html",
      reason: "stable-signature-dom-empty",
    },
    source: "conversation-update",
    action: "refresh",
    routeKind: "single-thread",
    threadHash: "thread-hash",
    currentTurns: 5,
    currentVisibleItems: 9,
    expectedVisibleTurnCount: 3,
    renderedDomTurnCount: 0,
    expectedVisibleItemCount: 6,
    renderedDomItemCount: 0,
    previousChildCount: 2,
    threadId: "thread-123",
  });

  assert.equal(plan.shouldRecordMismatch, true);
  assert.equal(plan.mismatchReason, "stable_signature_dom_empty");
  assert.deepEqual(plan.mismatchPayload, {
    source: "conversation-update",
    action: "refresh",
    routeKind: "single-thread",
    threadHash: "thread-hash",
    renderMode: "set-inner-html",
    currentTurns: 5,
    currentVisibleItems: 9,
    domCount: 0,
    domItemCount: 0,
    duplicateRenderKeyCount: 0,
    duplicateUserMessageCount: 0,
    expectedDuplicateUserMessageCount: 0,
    previousCount: 2,
  });
  assert.equal(plan.shouldPostClientEvent, true);
  assert.equal(plan.clientEventName, "conversation_dom_authority_invalidated");
  assert.deepEqual(plan.clientEventPayload, {
    threadId: "thread-123",
    reason: "stable-signature-dom-empty",
    expectedVisibleTurnCount: 3,
    renderedDomTurnCount: 0,
    expectedVisibleItemCount: 6,
    renderedDomItemCount: 0,
    duplicateRenderKeyCount: 0,
    duplicateUserMessageCount: 0,
    expectedDuplicateUserMessageCount: 0,
    action: "set-inner-html",
  });
});

test("conversation DOM authority invalidation covers non-empty projection shape mismatches", () => {
  const plan = domPatch.planConversationDomAuthorityInvalidation({
    updatePlan: {
      action: "set-inner-html",
      reason: "stable-signature-dom-turn-mismatch",
    },
    expectedVisibleTurnCount: 4,
    renderedDomTurnCount: 2,
    threadId: "thread-123",
  });

  assert.equal(plan.shouldRecordMismatch, true);
  assert.equal(plan.mismatchReason, "stable_signature_dom_turn_mismatch");
  assert.equal(plan.reason, "stable-signature-dom-turn-mismatch");
});

test("conversation DOM authority invalidation stays quiet for healthy updates", () => {
  assert.deepEqual(domPatch.planConversationDomAuthorityInvalidation({
    updatePlan: {
      action: "hydrate-existing",
      reason: "signature-stable",
    },
    expectedVisibleTurnCount: 3,
    renderedDomTurnCount: 3,
  }), {
    shouldRecordMismatch: false,
    mismatchReason: "",
    mismatchPayload: null,
    shouldPostClientEvent: false,
    clientEventName: "",
    clientEventPayload: null,
    reason: "not-authority-invalidated",
  });

  assert.deepEqual(domPatch.planConversationDomAuthorityInvalidation({
    updatePlan: {
      action: "patch-html",
      reason: "stable-signature-dom-empty",
    },
    expectedVisibleTurnCount: 0,
    renderedDomTurnCount: 0,
  }), {
    shouldRecordMismatch: false,
    mismatchReason: "",
    mismatchPayload: null,
    shouldPostClientEvent: false,
    clientEventName: "",
    clientEventPayload: null,
    reason: "no-expected-visible-content",
  });
});

test("conversation HTML update application exposes patch outcomes", () => {
  assert.deepEqual(domPatch.planConversationHtmlUpdateApplication({
    updatePlan: { action: "hydrate-existing" },
  }), {
    shouldMutateDom: false,
    primaryAction: "hydrate-existing",
    finalAction: "hydrate-existing",
    patchAttempted: false,
    patchApplied: false,
    fallbackApplied: false,
    patchRejectReason: "",
    reason: "hydrate-existing",
  });

  assert.deepEqual(domPatch.planConversationHtmlUpdateApplication({
    updatePlan: { action: "patch-html" },
    patchResult: { ok: true, reason: "patched" },
  }), {
    shouldMutateDom: true,
    primaryAction: "patch-html",
    finalAction: "patch-html",
    patchAttempted: true,
    patchApplied: true,
    fallbackApplied: false,
    patchRejectReason: "",
    reason: "patch-html",
  });

  assert.deepEqual(domPatch.planConversationHtmlUpdateApplication({
    updatePlan: { action: "patch-html" },
    patchResult: { ok: false, reason: "missing-document-private-detail-that-should-be-bounded" },
  }), {
    shouldMutateDom: true,
    primaryAction: "patch-html",
    finalAction: "set-inner-html",
    patchAttempted: true,
    patchApplied: false,
    fallbackApplied: true,
    patchRejectReason: "missing-document-private-detail-that-should-be-bounded",
    reason: "patch-html-failed",
  });

  assert.deepEqual(domPatch.planConversationHtmlUpdateApplication({
    updatePlan: { action: "set-inner-html" },
  }), {
    shouldMutateDom: true,
    primaryAction: "set-inner-html",
    finalAction: "set-inner-html",
    patchAttempted: false,
    patchApplied: false,
    fallbackApplied: false,
    patchRejectReason: "",
    reason: "set-inner-html",
  });
});

test("conversation post-apply DOM consistency requires fallback for partial patched DOM", () => {
  const plan = domPatch.planConversationPostApplyDomConsistency({
    updatePlan: {
      action: "patch-html",
      reason: "signature-changed",
    },
    applicationPlan: {
      finalAction: "patch-html",
    },
    expectedVisibleTurnCount: 3,
    renderedDomTurnCount: 2,
    expectedVisibleItemCount: 5,
    renderedDomItemCount: 5,
    readMode: "recent",
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.shouldFallbackToInnerHtml, true);
  assert.equal(plan.shouldReport, true);
  assert.equal(plan.reason, "post-apply-dom-turn-mismatch");
  assert.deepEqual(plan.diagnosticInput, {
    readMode: "recent",
    renderMode: "patch-html",
    renderPlanReason: "signature-changed",
    patchRejectReason: "post-apply-dom-turn-mismatch",
    previousVisibleItemCount: 5,
    visibleItemCount: 5,
  });

  assert.deepEqual(domPatch.planConversationPostApplyDomConsistency({
    updatePlan: { action: "set-inner-html", reason: "signature-changed" },
    applicationPlan: { finalAction: "set-inner-html" },
    expectedVisibleTurnCount: 1,
    renderedDomTurnCount: 1,
    expectedVisibleItemCount: 2,
    renderedDomItemCount: 2,
  }), {
    ok: true,
    shouldFallbackToInnerHtml: false,
    shouldReport: false,
    reason: "dom-consistent",
    diagnosticInput: null,
  });
});

test("conversation post-apply DOM consistency reports duplicate keys and order mismatches", () => {
  assert.equal(domPatch.planConversationPostApplyDomConsistency({
    applicationPlan: { finalAction: "patch-html" },
    duplicateUserMessageCount: 2,
    expectedDuplicateUserMessageCount: 1,
  }).reason, "post-apply-duplicate-user-messages");

  assert.equal(domPatch.planConversationPostApplyDomConsistency({
    applicationPlan: { finalAction: "set-inner-html" },
    duplicateRenderKeyCount: 2,
  }).reason, "post-apply-duplicate-render-keys");

  assert.equal(domPatch.planConversationPostApplyDomConsistency({
    applicationPlan: { finalAction: "patch-html" },
    expectedTurnIds: ["a", "b"],
    renderedDomTurnIds: ["b", "a"],
  }).reason, "post-apply-turn-order-mismatch");
});

test("conversation HTML patch fallback client event plan bounds payload fields", () => {
  assert.deepEqual(domPatch.planConversationHtmlPatchFallbackClientEvent({
    applicationPlan: {
      fallbackApplied: false,
    },
  }), {
    shouldPost: false,
    eventName: "",
    payload: null,
    reason: "no-fallback",
  });

  const plan = domPatch.planConversationHtmlPatchFallbackClientEvent({
    applicationPlan: {
      fallbackApplied: true,
      primaryAction: "patch-html",
      finalAction: "set-inner-html",
      patchRejectReason: "missing-document-private-detail-that-should-be-bounded-and-not-grow-longer-than-needed",
    },
    updatePlan: {
      reason: "stable-signature-dom-empty-private-detail-that-should-be-bounded-and-not-grow-longer-than-needed",
    },
    threadId: "thread-1",
    expectedVisibleTurnCount: 3.9,
    renderedDomTurnCount: "0",
  });

  assert.equal(plan.shouldPost, true);
  assert.equal(plan.eventName, "conversation_patch_html_fallback");
  assert.equal(plan.reason, "patch-html-fallback");
  assert.deepEqual(plan.payload, {
    threadId: "thread-1",
    reason: "missing-document-private-detail-that-should-be-bounded-and-not-grow-longer-than-",
    updateReason: "stable-signature-dom-empty-private-detail-that-should-be-bounded-and-not-grow-lo",
    expectedVisibleTurnCount: 3,
    renderedDomTurnCount: 0,
    action: "patch-html",
    finalAction: "set-inner-html",
  });
});

test("conversation HTML performance event plan owns bounded render payload", () => {
  const normal = domPatch.planConversationHtmlPerformanceEvent({
    updatePlan: {
      reason: "signature-changed",
    },
    applicationPlan: {
      finalAction: "patch-html",
      fallbackApplied: false,
    },
    renderElapsedMs: 12.6,
    html: "<article>ok</article>",
    previousChildCount: 2.9,
    childCount: 3.1,
    stickToBottom: true,
    threadId: "thread-1",
    currentThreadStatus: "active",
    slowThresholdMs: 120,
    minIntervalMs: 500,
  });

  assert.deepEqual(normal, {
    eventName: "conversation_render_ms",
    payload: {
      renderElapsedMs: 13,
      htmlChars: 21,
      previousChildCount: 2,
      childCount: 3,
      stickToBottom: true,
      threadId: "thread-1",
      currentThreadStatus: "active",
      updateReason: "signature-changed",
      domUpdateAction: "patch-html",
      patchFallbackApplied: false,
      patchRejectReason: "",
    },
    options: {
      key: "conversation_render_ms",
      minIntervalMs: 500,
      force: false,
    },
    reason: "normal-render",
  });

  const slowFallback = domPatch.planConversationHtmlPerformanceEvent({
    updatePlan: {
      reason: "stable-signature-dom-empty-private-detail-that-should-be-bounded-and-not-grow-longer-than-needed",
    },
    applicationPlan: {
      finalAction: "set-inner-html",
      fallbackApplied: true,
      patchRejectReason: "missing-document-private-detail-that-should-be-bounded-and-not-grow-longer-than-needed",
    },
    renderElapsedMs: 130,
    html: "<article>fallback</article>",
    previousChildCount: -1,
    childCount: 1,
    stickToBottom: false,
    threadId: "thread-2",
    currentThreadStatus: "completed",
    slowThresholdMs: 120,
    minIntervalMs: 500,
  });

  assert.equal(slowFallback.reason, "slow-render");
  assert.equal(slowFallback.options.force, true);
  assert.equal(slowFallback.options.minIntervalMs, 0);
  assert.equal(slowFallback.payload.previousChildCount, 0);
  assert.equal(slowFallback.payload.patchFallbackApplied, true);
  assert.equal(
    slowFallback.payload.updateReason,
    "stable-signature-dom-empty-private-detail-that-should-be-bounded-and-not-grow-lo",
  );
  assert.equal(
    slowFallback.payload.patchRejectReason,
    "missing-document-private-detail-that-should-be-bounded-and-not-grow-longer-than-",
  );
});

test("local conversation DOM update completion snapshot normalizes tile-pane terminal state", () => {
  assert.deepEqual(domPatch.planLocalConversationDomUpdateCompletionSnapshot({
    tilePanePatched: true,
    canPatchSingleThread: true,
    hasRoot: true,
    conversationSignature: "sig-next",
    patchShellSignature: "shell-next",
    scrollAction: "scroll-to-bottom",
  }), {
    tilePanePatched: true,
    canPatchSingleThread: false,
    hasRoot: true,
    conversationSignature: "",
    patchShellSignature: "",
    scrollAction: "none",
  });
});

test("local conversation DOM update completion snapshot normalizes single-thread facts", () => {
  assert.deepEqual(domPatch.planLocalConversationDomUpdateCompletionSnapshot({
    tilePanePatched: false,
    canPatchSingleThread: 1,
    hasRoot: "",
    conversationSignature: 123,
    patchShellSignature: null,
    scrollAction: "unknown",
  }), {
    tilePanePatched: false,
    canPatchSingleThread: true,
    hasRoot: false,
    conversationSignature: "123",
    patchShellSignature: "",
    scrollAction: "update-bottom-button",
  });

  assert.equal(domPatch.planLocalConversationDomUpdateCompletionSnapshot({
    tilePanePatched: false,
    scrollAction: "scroll-to-bottom",
  }).scrollAction, "scroll-to-bottom");
});

test("local conversation DOM update completion plan preserves tile pane terminal state", () => {
  assert.deepEqual(domPatch.planLocalConversationDomUpdateCompletion({
    tilePanePatched: true,
    canPatchSingleThread: true,
    hasRoot: true,
    conversationSignature: "sig-next",
    patchShellSignature: "shell-next",
    scrollAction: "scroll-to-bottom",
  }), {
    action: "tile-pane-complete",
    complete: true,
    reason: "tile-pane-patched",
    hydrateRoot: false,
    updateRenderedConversationSignature: false,
    updatePatchShellSignature: false,
    nextRenderedConversationSignature: "",
    nextRenderedConversationPatchShellSignature: "",
    scrollAction: "none",
  });
});

test("local conversation DOM update completion plan blocks unavailable single-thread patch", () => {
  assert.deepEqual(domPatch.planLocalConversationDomUpdateCompletion({
    tilePanePatched: false,
    canPatchSingleThread: false,
    hasRoot: true,
    conversationSignature: "sig-next",
    patchShellSignature: "shell-next",
    scrollAction: "scroll-to-bottom",
  }), {
    action: "blocked",
    complete: false,
    reason: "single-thread-unpatchable",
    hydrateRoot: false,
    updateRenderedConversationSignature: false,
    updatePatchShellSignature: false,
    nextRenderedConversationSignature: "",
    nextRenderedConversationPatchShellSignature: "",
    scrollAction: "none",
  });
});

test("local conversation DOM update completion plan updates single-thread signatures and scroll intent", () => {
  assert.deepEqual(domPatch.planLocalConversationDomUpdateCompletion({
    tilePanePatched: false,
    canPatchSingleThread: true,
    hasRoot: true,
    conversationSignature: "sig-next",
    patchShellSignature: "shell-next",
    scrollAction: "scroll-to-bottom",
  }), {
    action: "single-thread-complete",
    complete: true,
    reason: "single-thread-patched",
    hydrateRoot: true,
    hydrateOptions: {},
    updateRenderedConversationSignature: true,
    updatePatchShellSignature: true,
    nextRenderedConversationSignature: "sig-next",
    nextRenderedConversationPatchShellSignature: "shell-next",
    scrollAction: "scroll-to-bottom",
  });

  const noRootPlan = domPatch.planLocalConversationDomUpdateCompletion({
    tilePanePatched: false,
    canPatchSingleThread: true,
    hasRoot: false,
    conversationSignature: "sig-next",
    patchShellSignature: "shell-next",
    scrollAction: "unknown",
  });
  assert.equal(noRootPlan.hydrateRoot, false);
  assert.equal(noRootPlan.scrollAction, "update-bottom-button");
});

test("local conversation DOM update completion effects plan orders commit effects", () => {
  const completionPlan = domPatch.planLocalConversationDomUpdateCompletion({
    tilePanePatched: false,
    canPatchSingleThread: true,
    hasRoot: true,
    conversationSignature: "sig-next",
    patchShellSignature: "shell-next",
    scrollAction: "scroll-to-bottom",
  });

  assert.deepEqual(domPatch.planLocalConversationDomUpdateCompletionEffects(completionPlan), {
    effects: [
      {
        type: "hydrate-root",
        hydrateOptions: {},
      },
      {
        type: "set-rendered-conversation-signature",
        value: "sig-next",
      },
      {
        type: "set-rendered-conversation-patch-shell-signature",
        value: "shell-next",
      },
      {
        type: "schedule-conversation-to-bottom",
      },
    ],
    reason: "completion-effects",
  });
});

test("local conversation DOM update completion effects plan preserves terminal no-op states", () => {
  const tilePanePlan = domPatch.planLocalConversationDomUpdateCompletion({
    tilePanePatched: true,
    canPatchSingleThread: true,
    hasRoot: true,
    conversationSignature: "sig-next",
    patchShellSignature: "shell-next",
    scrollAction: "scroll-to-bottom",
  });
  assert.deepEqual(domPatch.planLocalConversationDomUpdateCompletionEffects(tilePanePlan), {
    effects: [],
    reason: "no-completion-effects",
  });

  const blockedPlan = domPatch.planLocalConversationDomUpdateCompletion({
    tilePanePatched: false,
    canPatchSingleThread: false,
    hasRoot: true,
    conversationSignature: "sig-next",
    patchShellSignature: "shell-next",
    scrollAction: "update-bottom-button",
  });
  assert.deepEqual(domPatch.planLocalConversationDomUpdateCompletionEffects(blockedPlan), {
    effects: [],
    reason: "completion-incomplete",
  });

  const updateButtonPlan = domPatch.planLocalConversationDomUpdateCompletion({
    tilePanePatched: false,
    canPatchSingleThread: true,
    hasRoot: false,
    conversationSignature: "sig-next",
    patchShellSignature: "",
    scrollAction: "update-bottom-button",
  });
  assert.deepEqual(domPatch.planLocalConversationDomUpdateCompletionEffects(updateButtonPlan).effects, [
    {
      type: "set-rendered-conversation-signature",
      value: "sig-next",
    },
    {
      type: "set-rendered-conversation-patch-shell-signature",
      value: "",
    },
    {
      type: "schedule-scroll-button-update",
    },
  ]);
});

test("thread detail refresh local patch transaction effects preserve commit order", () => {
  const completionSnapshot = domPatch.planLocalConversationDomUpdateCompletionSnapshot({
    tilePanePatched: false,
    canPatchSingleThread: true,
    hasRoot: true,
    conversationSignature: "sig-next",
    patchShellSignature: "shell-next",
    scrollAction: "scroll-to-bottom",
  });

  assert.deepEqual(domPatch.planThreadDetailRefreshLocalPatchTransactionEffects({
    completionSnapshot,
  }), {
    commitEffects: [
      {
        type: "complete-local-conversation-dom-update",
        name: "complete-local-conversation-dom-update",
        completionSnapshot,
      },
    ],
    afterSuccess: [
      {
        type: "update-live-operation-dock",
        name: "update-live-operation-dock",
      },
      {
        type: "bind-current-thread-actions",
        name: "bind-current-thread-actions",
      },
    ],
    reason: "refresh-local-patch-transaction-effects",
  });
});

function applyFixture(article, patchPlan, options = {}) {
  return domPatch.applyVisibleItemRefreshDomPatch({
    article,
    patchPlan,
    findElementByKey: (key) => article.nodes.find((node) => node.key === key) || null,
    renderElement: (entry) => (options.renderFails ? null : createNode(entry.key)),
    patchElement: (node, entry) => {
      if (options.patchFails) return null;
      node.patchedWith = entry.key;
      return node;
    },
  });
}

test("create element from html parses the first element through an injected document", () => {
  const node = domPatch.createElementFromHtml({
    document: createTemplateDocument(),
    html: '<article data-render-key="turn-a"></article>',
  });

  assert.equal(node.key, "turn-a");
  assert.equal(node.html, '<article data-render-key="turn-a"></article>');
});

test("create element from html returns null for blank html or document failures", () => {
  assert.equal(domPatch.createElementFromHtml({ document: createTemplateDocument(), html: "" }), null);
  assert.equal(domPatch.createElementFromHtml({ html: '<article data-render-key="turn-a"></article>' }), null);
  assert.equal(domPatch.createElementFromHtml({
    document: createTemplateDocument({ throwOnCreate: true }),
    html: '<article data-render-key="turn-a"></article>',
  }), null);
});

test("create turn article element renders through an injected turn renderer", () => {
  const turn = { id: "turn-a" };
  const previousKeys = new Set(["old"]);
  const calls = [];

  const node = domPatch.createTurnArticleElement({
    document: createTemplateDocument(),
    turn,
    previousKeys,
    renderTurnHtml(candidate, keys) {
      calls.push({ candidate, keys });
      return '<article data-render-key="turn-a"></article>';
    },
  });

  assert.equal(node.key, "turn-a");
  assert.deepEqual(calls, [{ candidate: turn, keys: previousKeys }]);
});

test("create turn article element returns null for missing inputs or render failures", () => {
  const turn = { id: "turn-a" };
  assert.equal(domPatch.createTurnArticleElement({
    document: createTemplateDocument(),
    renderTurnHtml: () => '<article data-render-key="turn-a"></article>',
  }), null);
  assert.equal(domPatch.createTurnArticleElement({
    document: createTemplateDocument(),
    turn,
  }), null);
  assert.equal(domPatch.createTurnArticleElement({
    document: createTemplateDocument(),
    turn,
    renderTurnHtml() {
      throw new Error("render failed");
    },
  }), null);
});

test("rendered surface hydration runs injected callbacks in order", () => {
  const root = { id: "root" };
  const calls = [];

  const result = domPatch.hydrateRenderedSurface({
    root,
    hydrateGitHubLinks(surface) {
      calls.push(["github", surface]);
    },
    hydrateMermaid(surface) {
      calls.push(["mermaid", surface]);
    },
    scheduleImageScan(surface) {
      calls.push(["scan", surface]);
    },
  });

  assert.deepEqual(result, {
    ok: true,
    reason: "hydrated",
    reused: 0,
    patched: 0,
    inserted: 0,
    githubHydrated: 1,
    mermaidHydrated: 1,
    imageScans: 1,
  });
  assert.deepEqual(calls, [
    ["github", root],
    ["mermaid", root],
    ["scan", root],
  ]);
});

test("rendered surface hydration preserves image scan delay arguments", () => {
  const root = { id: "root" };
  const delays = [0, 180];
  const calls = [];

  const result = domPatch.hydrateRenderedSurface({
    root,
    imageScanDelays: delays,
    scheduleImageScan(surface, scanDelays) {
      calls.push({ surface, scanDelays });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.imageScans, 1);
  assert.deepEqual(calls, [{ surface: root, scanDelays: delays }]);
});

test("rendered surface hydration returns bounded missing-root result", () => {
  assert.deepEqual(domPatch.hydrateRenderedSurface({}), {
    ok: false,
    reason: "missing-root",
    reused: 0,
    patched: 0,
    inserted: 0,
    githubHydrated: 0,
    mermaidHydrated: 0,
    imageScans: 0,
  });
});

test("rendered surface hydration propagates callback failures", () => {
  assert.throws(() => domPatch.hydrateRenderedSurface({
    root: { id: "root" },
    hydrateGitHubLinks() {
      throw new Error("hydrate failed");
    },
  }), /hydrate failed/);
});

test("turn article lookup finds an article by stable render key", () => {
  const expected = createNode("turn-a");
  const calls = [];
  const root = {
    querySelector(selector) {
      calls.push(selector);
      return selector === '[data-render-key="turn-a"]' ? expected : null;
    },
  };

  assert.equal(domPatch.findTurnArticleElement({
    conversation: root,
    turnKey: "turn-a",
    escapeSelectorAttr: (value) => String(value),
  }), expected);
  assert.deepEqual(calls, ['[data-render-key="turn-a"]']);
});

test("turn article lookup returns null for missing or invalid lookup inputs", () => {
  assert.equal(domPatch.findTurnArticleElement({ turnKey: "turn-a" }), null);
  assert.equal(domPatch.findTurnArticleElement({
    conversation: { querySelector: () => createNode("unexpected") },
  }), null);
  assert.equal(domPatch.findTurnArticleElement({
    conversation: {
      querySelector() {
        throw new Error("bad selector");
      },
    },
    turnKey: "turn-a",
  }), null);
});

test("visible item dom patch applies reuse, patch, and insert operations in order", () => {
  const article = createArticle([createNode("a"), createNode("b")]);
  const result = applyFixture(article, {
    canPatch: true,
    operations: [
      { type: "reuse", key: "a", nextEntry: { key: "a" } },
      { type: "patch", key: "b", nextEntry: { key: "b" } },
      { type: "insert", key: "c", nextEntry: { key: "c" } },
    ],
  });

  assert.deepEqual(result, {
    ok: true,
    reason: "applied",
    reused: 1,
    patched: 1,
    inserted: 1,
  });
  assert.deepEqual(article.nodes.map((node) => node.key), ["a", "b", "c"]);
  assert.equal(article.nodes[1].patchedWith, "b");
});

test("visible item dom patch inserts before the first child when no previous node was reused", () => {
  const article = createArticle([createNode("b")]);
  const result = applyFixture(article, {
    canPatch: true,
    operations: [
      { type: "insert", key: "a", nextEntry: { key: "a" } },
      { type: "reuse", key: "b", nextEntry: { key: "b" } },
    ],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(article.nodes.map((node) => node.key), ["a", "b"]);
});

test("visible item dom patch reorders reused nodes to match the next visible item order", () => {
  const article = createArticle([createNode("assistant-0839"), createNode("user-0834")]);
  const result = applyFixture(article, {
    canPatch: true,
    operations: [
      { type: "reuse", key: "user-0834", nextEntry: { key: "user-0834" } },
      { type: "reuse", key: "assistant-0839", nextEntry: { key: "assistant-0839" } },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.reused, 2);
  assert.deepEqual(article.nodes.map((node) => node.key), ["user-0834", "assistant-0839"]);
});

test("visible item dom patch validates reordered DOM item order after reuse", () => {
  const article = createDomElement("article", {}, [
    createDomElement("section", { "data-render-key": "assistant-0839", "data-item": "assistant" }),
    createDomElement("section", { "data-render-key": "user-0834", "data-item": "user" }),
  ]);
  const result = domPatch.applyVisibleItemRefreshDomPatch({
    article,
    patchPlan: {
      canPatch: true,
      operations: [
        { type: "reuse", key: "user-0834", nextEntry: { key: "user-0834" } },
        { type: "reuse", key: "assistant-0839", nextEntry: { key: "assistant-0839" } },
      ],
    },
    findElementByKey: (key) => article.childNodes
      .find((node) => node.getAttribute && node.getAttribute("data-render-key") === key) || null,
    renderElement: (entry) => createDomElement("section", { "data-render-key": entry.key, "data-item": entry.key }),
    patchElement: (node) => node,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    article.childNodes.map((node) => node.getAttribute("data-render-key")),
    ["user-0834", "assistant-0839"],
  );
});

test("visible item dom patch removes stale visible item nodes after filtering", () => {
  const stalePending = createDomElement("section", {
    "data-render-key": "item|thread|turn|local-user-submit",
    "data-item": "local-user-submit",
  }, [createDomText("pending")]);
  const durable = createDomElement("section", {
    "data-render-key": "item|thread|turn|durable-user",
    "data-item": "durable-user",
  }, [createDomText("durable")]);
  const status = createDomElement("div", {
    "data-render-key": "status|thread|turn",
  }, [createDomText("running")]);
  const article = createDomElement("article", {}, [stalePending, durable, status]);
  const findElementByKey = (key) => article.childNodes
    .find((node) => node.getAttribute && node.getAttribute("data-render-key") === key) || null;

  const result = domPatch.applyVisibleItemRefreshDomPatch({
    article,
    patchPlan: {
      canPatch: true,
      operations: [
        {
          type: "reuse",
          key: "item|thread|turn|durable-user",
          nextEntry: { key: "item|thread|turn|durable-user" },
        },
      ],
    },
    findElementByKey,
    renderElement: (entry) => createDomElement("section", { "data-render-key": entry.key, "data-item": entry.key }),
    patchElement: (node) => node,
  });

  assert.equal(result.ok, true);
  assert.equal(stalePending.parentNode, null);
  assert.deepEqual(
    article.childNodes.map((node) => node.getAttribute("data-render-key")),
    ["item|thread|turn|durable-user", "status|thread|turn"],
  );
});

test("visible item dom patch returns bounded failure reasons", () => {
  const article = createArticle([createNode("a")]);

  assert.equal(domPatch.applyVisibleItemRefreshDomPatch({ patchPlan: null }).reason, "plan-not-patchable");
  assert.equal(domPatch.applyVisibleItemRefreshDomPatch({ patchPlan: { canPatch: true, operations: [] } }).reason, "missing-article");
  assert.equal(domPatch.applyVisibleItemRefreshDomPatch({ article, patchPlan: { canPatch: true, operations: [] } }).reason, "missing-find-element");
  assert.equal(applyFixture(article, {
    canPatch: true,
    operations: [{ type: "reuse", key: "missing", nextEntry: { key: "missing" } }],
  }).reason, "missing-existing-node");
  assert.equal(applyFixture(article, {
    canPatch: true,
    operations: [{ type: "insert", key: "b", nextEntry: { key: "b" } }],
  }, { renderFails: true }).reason, "render-insert-node-failed");
  assert.equal(applyFixture(article, {
    canPatch: true,
    operations: [{ type: "patch", key: "a", nextEntry: { key: "a" } }],
  }, { patchFails: true }).reason, "patch-existing-node-failed");
  assert.equal(applyFixture(article, {
    canPatch: true,
    operations: [{ type: "remove", key: "a", nextEntry: { key: "a" } }],
  }).reason, "unknown-operation");
  assert.equal(applyFixture(article, {
    canPatch: true,
    operations: [{ type: "reuse", key: "a" }],
  }).reason, "invalid-operation");
});

test("visible item insertion appends after a rendered previous item at the end", () => {
  const article = createArticle([createNode("a"), createNode("b")]);
  const source = createNode("c");
  const entries = [{ key: "a" }, { key: "b" }, { key: "c" }];

  const result = domPatch.insertVisibleItemElement({
    article,
    source,
    entries,
    visibleIndex: 2,
    keyForEntry: (entry) => entry.key,
    findElementByKey: (key) => article.nodes.find((node) => node.key === key) || null,
  });

  assert.equal(result.ok, true);
  assert.equal(result.anchorMode, "append-after-previous");
  assert.deepEqual(article.nodes.map((node) => node.key), ["a", "b", "c"]);
});

test("visible item insertion uses the nearest rendered previous item as anchor", () => {
  const article = createArticle([createNode("a"), createNode("d")]);
  const source = createNode("c");
  const entries = [{ key: "a" }, { key: "b" }, { key: "c" }];

  const result = domPatch.insertVisibleItemElement({
    article,
    source,
    entries,
    visibleIndex: 2,
    keyForEntry: (entry) => entry.key,
    findElementByKey: (key) => article.nodes.find((node) => node.key === key) || null,
  });

  assert.equal(result.ok, true);
  assert.equal(result.anchorMode, "after-previous-before-next");
  assert.deepEqual(article.nodes.map((node) => node.key), ["a", "c", "d"]);
});

test("visible item insertion falls back to before first child when no previous item rendered", () => {
  const article = createArticle([createNode("b")]);
  const source = createNode("a");
  const entries = [{ key: "a" }, { key: "b" }];

  const result = domPatch.insertVisibleItemElement({
    article,
    source,
    entries,
    visibleIndex: 0,
    keyForEntry: (entry) => entry.key,
    findElementByKey: (key) => article.nodes.find((node) => node.key === key) || null,
  });

  assert.equal(result.ok, true);
  assert.equal(result.anchorMode, "before-first");
  assert.deepEqual(article.nodes.map((node) => node.key), ["a", "b"]);
});

test("visible item insertion returns bounded failure reasons", () => {
  const article = createArticle([createNode("a")]);
  const source = createNode("b");
  const entries = [{ key: "a" }, { key: "b" }];
  const keyForEntry = (entry) => entry.key;
  const findElementByKey = (key) => article.nodes.find((node) => node.key === key) || null;

  assert.equal(domPatch.insertVisibleItemElement({ source, entries, visibleIndex: 1, keyForEntry, findElementByKey }).reason, "missing-article");
  assert.equal(domPatch.insertVisibleItemElement({ article, entries, visibleIndex: 1, keyForEntry, findElementByKey }).reason, "missing-source");
  assert.equal(domPatch.insertVisibleItemElement({ article, source, entries, visibleIndex: -1, keyForEntry, findElementByKey }).reason, "invalid-visible-index");
  assert.equal(domPatch.insertVisibleItemElement({ article, source, entries, visibleIndex: 1, findElementByKey }).reason, "missing-key-lookup");
});

test("live text item dom patch finds, renders, and patches through injected callbacks", () => {
  const target = createNode("live-item");
  const calls = [];
  const root = {
    querySelector(selector) {
      calls.push(["query", selector]);
      return selector.includes("live-item") ? target : null;
    },
  };

  const result = domPatch.applyLiveTextItemDomPatch({
    root,
    key: "live-item",
    document: createTemplateDocument(),
    renderHtml: () => '<div data-render-key="live-item"></div>',
    patchElement: (node, source) => {
      calls.push(["patch", node.key, source.key]);
      node.patchedWith = source.key;
      return node;
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, "patched");
  assert.equal(result.patched, 1);
  assert.equal(result.target, target);
  assert.equal(target.patchedWith, "live-item");
  assert.deepEqual(calls, [
    ["query", '[data-render-key="live-item"]'],
    ["patch", "live-item", "live-item"],
  ]);
});

test("live text item dom patch returns bounded failure reasons", () => {
  const root = { querySelector: () => createNode("live-item") };
  const base = {
    root,
    key: "live-item",
    document: createTemplateDocument(),
    renderHtml: () => '<div data-render-key="live-item"></div>',
    patchElement: () => createNode("live-item"),
  };

  assert.equal(domPatch.applyLiveTextItemDomPatch({ key: "live-item" }).reason, "missing-root");
  assert.equal(domPatch.applyLiveTextItemDomPatch({ root }).reason, "missing-render-key");
  assert.equal(domPatch.applyLiveTextItemDomPatch({ root, key: "live-item" }).reason, "missing-render-html");
  assert.equal(domPatch.applyLiveTextItemDomPatch({
    root,
    key: "live-item",
    renderHtml: () => '<div data-render-key="live-item"></div>',
  }).reason, "missing-patch-element");
  assert.equal(domPatch.applyLiveTextItemDomPatch({
    ...base,
    root: { querySelector: () => null },
  }).reason, "missing-live-text-target");
  assert.equal(domPatch.applyLiveTextItemDomPatch({
    ...base,
    renderHtml: () => { throw new Error("render failed"); },
  }).reason, "render-live-text-html-failed");
  assert.equal(domPatch.applyLiveTextItemDomPatch({
    ...base,
    renderHtml: () => "",
  }).reason, "render-live-text-node-failed");
  assert.equal(domPatch.applyLiveTextItemDomPatch({
    ...base,
    patchElement: () => ({ ok: false, reason: "patch-denied" }),
  }).reason, "patch-denied");
});

test("turn dom patch applies item patch, insert, replace, and remove in order", () => {
  const turns = new Map([
    ["turn-a", { id: "turn-a" }],
    ["turn-b", { id: "turn-b" }],
    ["turn-c", { id: "turn-c" }],
  ]);
  const turnNodes = new Map([
    ["turn-a", createNode("turn-a")],
    ["turn-c", createNode("turn-c")],
    ["turn-stale", createNode("turn-stale")],
  ]);
  const conversation = createArticle([
    turnNodes.get("turn-c"),
    turnNodes.get("turn-a"),
    turnNodes.get("turn-stale"),
  ]);
  const calls = [];

  const result = domPatch.applyThreadTurnRefreshDomPatch({
    patchPlan: {
      canPatch: true,
      operations: [
        { type: "item-patch", key: "turn-a" },
        { type: "insert-turn", key: "turn-b" },
        { type: "replace-turn", key: "turn-c" },
        { type: "remove-turn", key: "turn-stale" },
      ],
    },
    conversation,
    findTurnByKey: (key) => turns.get(key),
    findTurnElementByKey: (key) => turnNodes.get(key) || null,
    applyItemPatch: (turn) => {
      calls.push(`item:${turn.id}`);
      return { ok: true };
    },
    renderTurnElement: (turn) => {
      calls.push(`render:${turn.id}`);
      return createNode(turn.id);
    },
    insertTurnElement: (source, turn) => {
      calls.push(`insert:${turn.id}:${source.key}`);
      turnNodes.set(turn.id, source);
      return { ok: true, target: source };
    },
    replaceTurnElement: (source, turn) => {
      calls.push(`replace:${turn.id}:${source.key}`);
      return { ok: true, target: turnNodes.get(turn.id) };
    },
    removeTurnElement: (operation) => {
      calls.push(`remove:${operation.key}`);
      const node = turnNodes.get(operation.key);
      const index = conversation.nodes.indexOf(node);
      if (index >= 0) conversation.nodes.splice(index, 1);
      syncSiblings(conversation.nodes);
      return { ok: true };
    },
  });

  assert.deepEqual(result, {
    ok: true,
    reason: "applied",
    reused: 0,
    patched: 2,
    inserted: 1,
    itemPatched: 1,
    replaced: 1,
    removed: 1,
    reordered: 2,
  });
  assert.deepEqual(conversation.nodes.map((node) => node.key), ["turn-a", "turn-b", "turn-c"]);
  assert.deepEqual(calls, [
    "item:turn-a",
    "render:turn-b",
    "insert:turn-b:turn-b",
    "render:turn-c",
    "replace:turn-c:turn-c",
    "remove:turn-stale",
  ]);
});

test("turn dom patch returns bounded failure reasons", () => {
  const turn = { id: "turn-a" };
  const article = createNode("turn-a");
  const conversation = createArticle([article]);
  const base = {
    findTurnByKey: () => turn,
    findTurnElementByKey: () => article,
    conversation,
    applyItemPatch: () => ({ ok: true }),
    renderTurnElement: () => createNode("turn-a"),
    insertTurnElement: (source) => ({ ok: true, target: source }),
    replaceTurnElement: () => ({ ok: true, target: article }),
  };

  assert.equal(domPatch.applyThreadTurnRefreshDomPatch({ patchPlan: null }).reason, "turn-patch-plan-not-patchable");
  assert.equal(domPatch.applyThreadTurnRefreshDomPatch({ patchPlan: { canPatch: true, operations: [] } }).reason, "missing-find-turn");
  assert.equal(domPatch.applyThreadTurnRefreshDomPatch({
    patchPlan: { canPatch: true, operations: [{ type: "item-patch", key: "missing" }] },
    ...base,
    findTurnByKey: () => null,
  }).reason, "turn-patch-operation-missing-turn");
  assert.equal(domPatch.applyThreadTurnRefreshDomPatch({
    patchPlan: { canPatch: true, operations: [{ type: "item-patch", key: "turn-a" }] },
    ...base,
    applyItemPatch: () => ({ ok: false, reason: "item-patch-failed" }),
  }).reason, "item-patch-failed");
  assert.equal(domPatch.applyThreadTurnRefreshDomPatch({
    patchPlan: { canPatch: true, operations: [{ type: "item-patch", key: "turn-a" }] },
    ...base,
    findTurnElementByKey: null,
  }).reason, "missing-find-turn-element");
  assert.equal(domPatch.applyThreadTurnRefreshDomPatch({
    patchPlan: { canPatch: true, operations: [{ type: "item-patch", key: "turn-a" }] },
    ...base,
    conversation: null,
  }).reason, "missing-turn-order-root");
  assert.equal(domPatch.applyThreadTurnRefreshDomPatch({
    patchPlan: { canPatch: true, operations: [{ type: "insert-turn", key: "turn-a" }] },
    ...base,
    renderTurnElement: () => null,
  }).reason, "render-turn-failed");
  assert.equal(domPatch.applyThreadTurnRefreshDomPatch({
    patchPlan: { canPatch: true, operations: [{ type: "insert-turn", key: "turn-a" }] },
    ...base,
    insertTurnElement: () => ({ ok: false, reason: "insert-turn-failed" }),
  }).reason, "insert-turn-failed");
  assert.equal(domPatch.applyThreadTurnRefreshDomPatch({
    patchPlan: { canPatch: true, operations: [{ type: "replace-turn", key: "turn-a" }] },
    ...base,
    replaceTurnElement: () => ({ ok: false, reason: "replace-turn-missing-article" }),
  }).reason, "replace-turn-missing-article");
  assert.equal(domPatch.applyThreadTurnRefreshDomPatch({
    patchPlan: { canPatch: true, operations: [{ type: "remove-turn", key: "turn-a" }] },
    ...base,
  }).reason, "missing-remove-turn");
  assert.equal(domPatch.applyThreadTurnRefreshDomPatch({
    patchPlan: { canPatch: true, operations: [{ type: "remove-turn", key: "turn-a" }] },
    ...base,
    removeTurnElement: () => ({ ok: false, reason: "remove-turn-failed" }),
  }).reason, "remove-turn-failed");
  assert.equal(domPatch.applyThreadTurnRefreshDomPatch({
    patchPlan: { canPatch: true, operations: [{ type: "item-patch" }] },
    ...base,
  }).reason, "invalid-turn-operation");
});

test("thread detail patch transaction runs success effects only after patch success", () => {
  const calls = [];
  const success = domPatch.applyThreadDetailPatchTransaction({
    applyPatch: () => {
      calls.push("patch");
      return { ok: true, reason: "applied", patched: 2, inserted: 1 };
    },
    afterSuccess: [
      {
        name: "dock",
        apply: () => {
          calls.push("dock");
          return { ok: true };
        },
      },
      () => {
        calls.push("bind");
        return true;
      },
    ],
  });

  assert.deepEqual(success, {
    ok: true,
    reason: "transaction-applied",
    reused: 0,
    patched: 2,
    inserted: 1,
    effectsApplied: 2,
    commitEffectsApplied: 0,
    postCommitEffectsApplied: 2,
  });
  assert.deepEqual(calls, ["patch", "dock", "bind"]);

  calls.length = 0;
  const failed = domPatch.applyThreadDetailPatchTransaction({
    applyPatch: () => {
      calls.push("patch");
      return { ok: false, reason: "item-patch-failed" };
    },
    afterSuccess: [
      () => {
        calls.push("dock");
        return { ok: true };
      },
    ],
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, "item-patch-failed");
  assert.equal(failed.effectsApplied, 0);
  assert.equal(failed.commitEffectsApplied, 0);
  assert.equal(failed.postCommitEffectsApplied, 0);
  assert.deepEqual(calls, ["patch"]);
});

test("thread detail patch transaction runs post-commit effects only after commit succeeds", () => {
  const calls = [];
  const failedCommit = domPatch.applyThreadDetailPatchTransaction({
    applyPatch: () => {
      calls.push("patch");
      return { ok: true };
    },
    commitEffects: [
      {
        name: "complete",
        apply: () => {
          calls.push("complete");
          return { ok: false, reason: "complete-dom-update-failed" };
        },
      },
    ],
    afterSuccess: [
      {
        name: "dock",
        apply: () => {
          calls.push("dock");
          return { ok: true };
        },
      },
    ],
  });

  assert.equal(failedCommit.ok, false);
  assert.equal(failedCommit.reason, "complete-dom-update-failed");
  assert.equal(failedCommit.effectsApplied, 0);
  assert.equal(failedCommit.commitEffectsApplied, 0);
  assert.equal(failedCommit.postCommitEffectsApplied, 0);
  assert.deepEqual(calls, ["patch", "complete"]);

  calls.length = 0;
  const success = domPatch.applyThreadDetailPatchTransaction({
    applyPatch: () => {
      calls.push("patch");
      return { ok: true };
    },
    commitEffects: [
      {
        name: "complete",
        apply: () => {
          calls.push("complete");
          return { ok: true };
        },
      },
    ],
    afterSuccess: [
      {
        name: "dock",
        apply: () => {
          calls.push("dock");
          return { ok: true };
        },
      },
    ],
  });

  assert.equal(success.ok, true);
  assert.equal(success.effectsApplied, 2);
  assert.equal(success.commitEffectsApplied, 1);
  assert.equal(success.postCommitEffectsApplied, 1);
  assert.deepEqual(calls, ["patch", "complete", "dock"]);
});

test("thread detail patch transaction reports bounded effect failures", () => {
  assert.equal(domPatch.applyThreadDetailPatchTransaction({}).reason, "missing-apply-patch");
  assert.equal(domPatch.applyThreadDetailPatchTransaction({
    applyPatch: () => ({ ok: true }),
    afterSuccess: [null],
  }).reason, "invalid-transaction-effect");
  assert.equal(domPatch.applyThreadDetailPatchTransaction({
    applyPatch: () => ({ ok: true }),
    afterSuccess: [
      {
        name: "complete",
        apply: () => ({ ok: false, reason: "complete-dom-update-failed" }),
      },
    ],
  }).reason, "complete-dom-update-failed");
  assert.equal(domPatch.applyThreadDetailPatchTransaction({
    applyPatch: () => ({ ok: true }),
    afterSuccess: [
      {
        name: "dock",
        apply: () => {
          throw new Error("boom");
        },
      },
    ],
  }).reason, "dock-threw");
});

test("turn article insertion anchors after the nearest rendered previous turn", () => {
  const turnA = { id: "a" };
  const turnB = { id: "b" };
  const turnC = { id: "c" };
  const article = createArticle([createNode("a"), createNode("d")]);
  const source = createNode("c");

  const result = domPatch.insertTurnArticleElement({
    conversation: article,
    turn: turnC,
    source,
    visibleTurns: [turnA, turnB, turnC],
    findTurnElement: (turn) => article.nodes.find((node) => node.key === turn.id) || null,
    firstTurnElement: () => article.firstChild,
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, "after-previous-turn");
  assert.deepEqual(article.nodes.map((node) => node.key), ["a", "c", "d"]);
});

test("turn article insertion falls back to before first turn or append", () => {
  const turnA = { id: "a" };
  const turnB = { id: "b" };
  const article = createArticle([createNode("b")]);
  const source = createNode("a");

  const beforeFirst = domPatch.insertTurnArticleElement({
    conversation: article,
    turn: turnA,
    source,
    visibleTurns: [turnA, turnB],
    findTurnElement: (turn) => article.nodes.find((node) => node.key === turn.id) || null,
    firstTurnElement: () => article.firstChild,
  });

  assert.equal(beforeFirst.ok, true);
  assert.equal(beforeFirst.reason, "before-first-turn");
  assert.deepEqual(article.nodes.map((node) => node.key), ["a", "b"]);

  const emptyArticle = createArticle([]);
  const append = domPatch.insertTurnArticleElement({
    conversation: emptyArticle,
    turn: turnA,
    source: createNode("a"),
    visibleTurns: [turnA],
    findTurnElement: () => null,
    firstTurnElement: () => emptyArticle.firstChild,
  });

  assert.equal(append.ok, true);
  assert.equal(append.reason, "append");
  assert.deepEqual(emptyArticle.nodes.map((node) => node.key), ["a"]);
});

test("turn article insertion returns bounded failure reasons", () => {
  const turn = { id: "a" };
  const source = createNode("a");
  const article = createArticle([]);

  assert.equal(domPatch.insertTurnArticleElement({ turn, source }).reason, "missing-conversation");
  assert.equal(domPatch.insertTurnArticleElement({ conversation: article, turn }).reason, "missing-source");
  assert.equal(domPatch.insertTurnArticleElement({ conversation: article, source }).reason, "missing-turn");
  assert.equal(domPatch.insertTurnArticleElement({
    conversation: article,
    turn,
    source,
  }).reason, "missing-find-turn-element");
});
