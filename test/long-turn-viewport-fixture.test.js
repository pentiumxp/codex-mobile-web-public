"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const fixture = require(path.join(__dirname, "..", "scripts", "codex-mobile-long-turn-viewport-fixture.js"));

test("long-turn viewport fixture args are bounded", () => {
  const options = fixture.parseArgs([
    "--width", "240",
    "--height", "400",
    "--font-size", "xxlarge",
    "--paragraphs", "120",
    "--json",
  ]);

  assert.equal(options.width, 320);
  assert.equal(options.height, 560);
  assert.equal(options.fontSize, "xxlarge");
  assert.equal(options.paragraphs, 90);
  assert.equal(options.json, true);
});

test("long-turn viewport fixture html uses the real single-thread anchors", () => {
  const html = fixture.fixtureHtml("", { width: 390, height: 844, paragraphs: 18 });

  assert.match(html, /id="conversation" class="conversation"/);
  assert.match(html, /id="composer" class="composer"/);
  assert.match(html, /id="scrollToBottom" class="scroll-bottom-button"/);
  assert.match(html, /id="scrollToTurnReply" class="scroll-bottom-button scroll-turn-reply-button hidden"/);
  assert.match(html, /article class="turn" data-turn="fixture-turn-final"/);
  assert.match(html, /section class="item agentMessage" data-item="fixture-final-receipt"/);
  assert.match(html, /section class="item turnUsageSummary" data-item="fixture-usage"/);
  assert.match(html, /details class="turn-usage-summary risk-normal"/);
});

test("long-turn viewport fixture checks key visual invariants", () => {
  const html = fixture.fixtureHtml("", { width: 390, height: 844, paragraphs: 18 });

  assert.match(html, /jumpButtonsMutuallyExclusive/);
  assert.match(html, /jumpButtonsShareSlot/);
  assert.match(html, /buttonsAboveComposer/);
  assert.match(html, /receiptStartAligned/);
  assert.match(html, /receiptStartBandVisible/);
  assert.match(html, /receiptStartBandNoComposerOverlap/);
  assert.match(html, /usageVisibleAtBottom/);
  assert.match(html, /usageNoComposerOverlap/);
  assert.match(html, /composerBelowConversation/);
  assert.match(html, /longReceiptScrollable/);
});

test("long-turn viewport fixture result parsing handles escaped JSON", () => {
  const parsed = fixture.extractResult('<pre id="fixtureResult" class="fixture-result">{&quot;ok&quot;:true,&quot;value&quot;:&quot;a&amp;b&quot;}</pre>');

  assert.deepEqual(parsed, { ok: true, value: "a&b" });
});

test("long-turn viewport fixture artifact reporting does not expose paths", () => {
  const result = fixture.safeArtifactResult("/Users/example/private/long-turn.png");

  assert.equal(result.pathHash, fixture.stableTextHash("/Users/example/private/long-turn.png"));
  assert.equal(Object.hasOwn(result, "path"), false);
  assert.doesNotMatch(JSON.stringify(result), /Users|example|private|long-turn\.png/);
});

test("long-turn viewport fixture does not emit private local paths in successful output shape", () => {
  const html = fixture.fixtureHtml("", { width: 390, height: 844, paragraphs: 18 });

  assert.doesNotMatch(html, /\/Users\/|token=|cookie=|Authorization|Bearer/);
});
