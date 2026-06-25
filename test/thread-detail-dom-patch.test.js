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

test("turn dom patch applies item patch, insert turn, and replace turn in order", () => {
  const turns = new Map([
    ["turn-a", { id: "turn-a" }],
    ["turn-b", { id: "turn-b" }],
    ["turn-c", { id: "turn-c" }],
  ]);
  const calls = [];

  const result = domPatch.applyThreadTurnRefreshDomPatch({
    patchPlan: {
      canPatch: true,
      operations: [
        { type: "item-patch", key: "turn-a" },
        { type: "insert-turn", key: "turn-b" },
        { type: "replace-turn", key: "turn-c" },
      ],
    },
    findTurnByKey: (key) => turns.get(key),
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
      return { ok: true };
    },
    replaceTurnElement: (source, turn) => {
      calls.push(`replace:${turn.id}:${source.key}`);
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
  });
  assert.deepEqual(calls, [
    "item:turn-a",
    "render:turn-b",
    "insert:turn-b:turn-b",
    "render:turn-c",
    "replace:turn-c:turn-c",
  ]);
});

test("turn dom patch returns bounded failure reasons", () => {
  const turn = { id: "turn-a" };
  const base = {
    findTurnByKey: () => turn,
    applyItemPatch: () => ({ ok: true }),
    renderTurnElement: () => createNode("turn-a"),
    insertTurnElement: () => ({ ok: true }),
    replaceTurnElement: () => ({ ok: true }),
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
  }).reason, "unknown-turn-patch-operation");
  assert.equal(domPatch.applyThreadTurnRefreshDomPatch({
    patchPlan: { canPatch: true, operations: [{ type: "item-patch" }] },
    ...base,
  }).reason, "invalid-turn-operation");
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
