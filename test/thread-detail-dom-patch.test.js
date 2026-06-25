"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const domPatch = require(path.resolve(__dirname, "..", "public", "thread-detail-dom-patch.js"));

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
