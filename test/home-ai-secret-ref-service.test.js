"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  appendSecretRefReceiptText,
  createHomeAiSecretRefService,
  normalizeSecretRefsFromInput,
  publicSecretRefConsumeResult,
  publicSensitiveContext,
  secretRefReceiptText,
} = require("../services/runtime/home-ai-secret-ref-service");

test("Home AI secretRef metadata normalizes to bounded receipts without plaintext", () => {
  const context = normalizeSecretRefsFromInput({
    secretRef: {
      id: "sec_alpha1234567890",
      expiresInSeconds: 600,
      targetPlugin: "codex",
      purpose: "profile-login",
    },
  }, {
    source: "task-card",
    sourceThreadId: "source-thread",
    targetThreadId: "target-thread",
    workspaceId: "codex-mobile-web",
  });

  assert.equal(context.secretRefs.length, 1);
  assert.equal(context.secretRefs[0].id, "sec_alpha1234567890");
  const publicContext = publicSensitiveContext(context);
  assert.equal(publicContext.secretRefs[0].id, "sec_alph...7890");
  assert.equal(publicContext.secretRefs[0].targetPlugin, "codex");
  assert.equal(publicContext.secretRefs[0].expiresInMinutes, 10);
  assert.match(secretRefReceiptText(context), /已收到安全凭据 sec_alph\.\.\.7890，10 分钟内可用于当前任务。/);
  assert.match(appendSecretRefReceiptText("Use the credential.", context), /Use the credential\.[\s\S]*sec_alph\.\.\.7890/);
  assert.doesNotMatch(JSON.stringify(publicContext), /sec_alpha1234567890/);
});

test("Home AI secretRef normalization rejects inline plaintext and wrong plugin scope", () => {
  assert.throws(() => normalizeSecretRefsFromInput({
    secretRef: {
      id: "sec_alpha1234567890",
      value: "REAL_PASSWORD_SHOULD_NOT_LEAK",
    },
  }), /secret_ref_plaintext_disallowed/);

  assert.throws(() => normalizeSecretRefsFromInput({
    secretRef: {
      id: "sec_alpha1234567890",
      targetPlugin: "finance",
    },
  }), /secret_ref_target_plugin_invalid/);

  assert.throws(() => normalizeSecretRefsFromInput({
    secretRef: "not-a-secret-ref",
  }), /secret_ref_invalid/);
});

test("Home AI secretRef service consumes through bounded broker API and redacts public result", async () => {
  const calls = [];
  const service = createHomeAiSecretRefService({
    baseUrl: "https://home-ai.example.test/base",
    webKey: "web-key",
    consumePath: "/api/secret-refs/consume",
    fetchImpl: async (url, init) => {
      calls.push({
        url,
        headers: init.headers,
        body: JSON.parse(init.body),
      });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          ok: true,
          value: "REAL_PASSWORD_SHOULD_NOT_LEAK",
          eventId: "evt_1",
        }),
      };
    },
  });

  const result = await service.consumeSecretRef("sec_bravo1234567890", {
    purpose: "profile-login",
    action: "codex-profile-auth",
    scope: {
      threadId: "thread-1",
      taskCardId: "ttc_1",
      workspaceId: "codex-mobile-web",
    },
  });

  assert.equal(result.value, "REAL_PASSWORD_SHOULD_NOT_LEAK");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://home-ai.example.test/base/api/secret-refs/consume");
  assert.equal(calls[0].headers["X-Hermes-Web-Key"], "web-key");
  assert.equal(calls[0].body.secretRef, "sec_bravo1234567890");
  assert.equal(calls[0].body.targetPlugin, "codex");
  assert.equal(calls[0].body.scope.threadId, "thread-1");

  const publicResult = publicSecretRefConsumeResult(result);
  const publicJson = JSON.stringify(publicResult);
  assert.equal(publicResult.ok, true);
  assert.equal(publicResult.consumed, true);
  assert.match(publicJson, /sec_brav\.\.\.7890/);
  assert.doesNotMatch(publicJson, /REAL_PASSWORD_SHOULD_NOT_LEAK|sec_bravo1234567890|web-key/);
});

test("Home AI secretRef broker failures map to fail-closed bounded errors", async () => {
  const service = createHomeAiSecretRefService({
    baseUrl: "https://home-ai.example.test",
    webKey: "web-key",
    fetchImpl: async () => ({
      ok: false,
      status: 410,
      text: async () => JSON.stringify({
        ok: false,
        error: "expired",
        value: "REAL_PASSWORD_SHOULD_NOT_LEAK",
      }),
    }),
  });

  await assert.rejects(
    () => service.consumeSecretRef("sec_charlie1234567890", { purpose: "profile-login" }),
    (err) => {
      assert.equal(err.message, "home_ai_secret_ref_expired");
      assert.equal(err.statusCode, 410);
      assert.doesNotMatch(`${err.message} ${JSON.stringify(err.details || {})}`, /REAL_PASSWORD_SHOULD_NOT_LEAK|sec_charlie1234567890|web-key/);
      return true;
    },
  );
});
