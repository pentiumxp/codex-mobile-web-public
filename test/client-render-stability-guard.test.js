"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const guard = require("../public/client-render-stability-guard");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const swJs = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");

function functionBody(name) {
  let start = appJs.indexOf(`function ${name}(`);
  if (start === -1) start = appJs.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const signatureEnd = appJs.indexOf(") {", start);
  const brace = appJs.indexOf("{", signatureEnd === -1 ? start : signatureEnd);
  let depth = 0;
  for (let index = brace; index < appJs.length; index += 1) {
    if (appJs[index] === "{") depth += 1;
    if (appJs[index] === "}") {
      depth -= 1;
      if (depth === 0) return appJs.slice(start, index + 1);
    }
  }
  throw new Error(`could not parse function ${name}`);
}

test("client render stability guard keeps submitted turn identity stable across reconcile", () => {
  const sourceTurn = {
    id: "local-turn-submission-secret",
    items: [{ type: "userMessage", clientSubmissionId: "submission-secret", mobilePendingSubmission: true }],
  };
  const targetTurn = {
    id: "server-turn-1",
    items: [{ type: "userMessage", clientSubmissionId: "submission-secret" }],
  };

  const sourceKey = guard.markSubmittedTurn(sourceTurn, "submission-secret");
  const transferred = guard.transferSubmittedTurnIdentity(sourceTurn, targetTurn, "submission-secret");

  assert.equal(sourceKey, transferred);
  assert.equal(guard.stableTurnIdentity(sourceTurn), sourceKey);
  assert.equal(guard.stableTurnIdentity(targetTurn), sourceKey);
  assert.doesNotMatch(sourceKey, /submission-secret/);
});

test("client render stability guard falls back to durable turn id for non-submission turns", () => {
  assert.equal(guard.stableTurnIdentity({ id: "turn-123", items: [] }), "turn-123");
  assert.equal(guard.stableTurnIdentity({ startedAt: 1782000000, items: [] }), "1782000000");
  assert.equal(guard.stableTurnIdentity(null), "turn");
});

test("send-message render path uses stable submitted-turn identity instead of turn id churn", () => {
  assert.match(appJs, /const clientRenderStabilityGuard = window\.CodexClientRenderStabilityGuard/);
  assert.match(functionBody("insertLocalSubmittedUserMessage"), /clientRenderStabilityGuard\.markSubmittedTurn\(turn, submissionId\)/);
  assert.match(functionBody("reconcileSubmittedUserMessageTurn"), /clientRenderStabilityGuard\.transferSubmittedTurnIdentity\(sourceTurn, targetTurn, submissionId\)/);
  assert.match(functionBody("stableTurnKey"), /clientRenderStabilityGuard\.stableTurnIdentity\(turn\)/);
  assert.match(functionBody("stableItemKey"), /clientRenderStabilityGuard\.stableTurnIdentity\(turn\)/);
});

test("client render stability guard is part of the static shell", () => {
  assert.match(indexHtml, /<script src="\/client-render-stability-guard\.js"><\/script>/);
  assert.match(swJs, /"\/client-render-stability-guard\.js"/);
  assert.match(appJs, /"\/client-render-stability-guard\.js"/);
  assert.match(serverJs, /"client-render-stability-guard\.js"/);
  assert.match(appJs, /CLIENT_BUILD_ID = "0\.1\.11\|codex-mobile-shell-v600"/);
  assert.match(swJs, /CACHE_NAME = "codex-mobile-shell-v600"/);
});
