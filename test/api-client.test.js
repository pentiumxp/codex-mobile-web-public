"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const apiClientModule = require(path.resolve(__dirname, "..", "public", "api-client.js"));

class TestAbortController {
  constructor() {
    this.signal = {
      aborted: false,
      addEventListener() {},
      removeEventListener() {},
    };
  }

  abort() {
    this.signal.aborted = true;
  }
}

test("api client adds auth and json headers for normal requests", async () => {
  let seenOptions = null;
  const client = apiClientModule.createApiClient({
    AbortControllerCtor: TestAbortController,
    getKey: () => "secret",
    fetch: async (_path, options) => {
      seenOptions = options;
      return {
        status: 200,
        ok: true,
        json: async () => ({ ok: true }),
      };
    },
  });

  assert.deepEqual(await client.request("/api/test", { method: "POST", body: "{}" }), { ok: true });
  assert.equal(seenOptions.headers["X-Codex-Mobile-Key"], "secret");
  assert.equal(seenOptions.headers["Content-Type"], "application/json");
  assert.equal("timeoutMs" in seenOptions, false);
});

test("api client preserves form data content type handling", async () => {
  class FakeFormData {}
  let seenOptions = null;
  const client = apiClientModule.createApiClient({
    AbortControllerCtor: TestAbortController,
    FormDataCtor: FakeFormData,
    fetch: async (_path, options) => {
      seenOptions = options;
      return {
        status: 204,
        ok: true,
        json: async () => {
          throw new Error("should not parse 204");
        },
      };
    },
  });

  assert.equal(await client.request("/api/upload", { method: "POST", body: new FakeFormData() }), null);
  assert.equal(seenOptions.headers["Content-Type"], undefined);
});

test("api client reports unauthorized responses and server error payloads", async () => {
  let unauthorized = 0;
  const unauthorizedClient = apiClientModule.createApiClient({
    AbortControllerCtor: TestAbortController,
    onUnauthorized: () => {
      unauthorized += 1;
    },
    fetch: async () => ({
      status: 401,
      statusText: "Unauthorized",
      ok: false,
      json: async () => ({}),
    }),
  });
  await assert.rejects(() => unauthorizedClient.request("/api/private"), /Unauthorized/);
  assert.equal(unauthorized, 1);

  const errorClient = apiClientModule.createApiClient({
    AbortControllerCtor: TestAbortController,
    fetch: async () => ({
      status: 500,
      statusText: "Server Error",
      ok: false,
      json: async () => ({ error: "backend failed" }),
    }),
  });
  await assert.rejects(() => errorClient.request("/api/fail"), /backend failed/);

  const codedClient = apiClientModule.createApiClient({
    AbortControllerCtor: TestAbortController,
    fetch: async () => ({
      status: 409,
      statusText: "Conflict",
      ok: false,
      json: async () => ({
        error: "auth failed",
        code: "codex_account_auth_invalid",
        detail: "token_expired",
        requestId: "profile-switch-1",
        progress: {
          status: "failed",
          stage: "failed",
          message: "切换失败：目标账号登录已失效",
        },
      }),
    }),
  });
  await assert.rejects(async () => {
    await codedClient.request("/api/fail-coded");
  }, (err) => {
    assert.equal(err.message, "auth failed");
    assert.equal(err.status, 409);
    assert.equal(err.code, "codex_account_auth_invalid");
    assert.equal(err.detail, "token_expired");
    assert.equal(err.requestId, "profile-switch-1");
    assert.equal(err.progress.status, "failed");
    assert.equal(err.responseBody.progress.stage, "failed");
    return true;
  });
});

test("api client distinguishes timeout aborts from external cancellations", async () => {
  const timeoutClient = apiClientModule.createApiClient({
    AbortControllerCtor: TestAbortController,
    fetch: async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw err;
    },
  });
  await assert.rejects(() => timeoutClient.request("/api/slow", { timeoutMs: 1 }), /Request timed out: \/api\/slow/);

  const externalSignal = {
    aborted: true,
    addEventListener() {},
    removeEventListener() {},
  };
  const cancelledClient = apiClientModule.createApiClient({
    AbortControllerCtor: TestAbortController,
    fetch: async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    },
  });
  await assert.rejects(() => cancelledClient.request("/api/cancelled", { signal: externalSignal }), /Request cancelled: \/api\/cancelled/);
});
