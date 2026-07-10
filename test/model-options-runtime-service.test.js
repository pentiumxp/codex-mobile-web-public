"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createModelOptionsRuntimeService,
  extractModelOptionsFromModelListResponse,
  normalizeModelOption,
  normalizeModelOptions,
} = require("../services/runtime/model-options-runtime-service");

test("model options runtime extracts provider model/list options", async () => {
  const calls = [];
  const service = createModelOptionsRuntimeService({
    fallbackModelOptions: ["gpt-5.5"],
    defaultModel: "gpt-5.5",
    now: () => 1000,
    codex: {
      request: async (method, params, options) => {
        calls.push({ method, params, options });
        return {
          data: [
            { id: "hidden-model", model: "hidden-model", hidden: true },
            { id: "gpt-5.6-sol", model: "gpt-5.6-sol", displayName: "GPT-5.6 Sol" },
            { id: "gpt-5.5", model: "gpt-5.5" },
            { id: "bad whitespace", model: "bad whitespace" },
            { id: "gpt-5.6-sol", model: "gpt-5.6-sol" },
          ],
          nextCursor: null,
        };
      },
    },
  });

  const options = await service.effectiveModelOptions({ force: true });

  assert.deepEqual(options, ["gpt-5.6-sol", "gpt-5.5"]);
  assert.equal(calls[0].method, "model/list");
  assert.equal(calls[0].params.includeHidden, false);
  assert.equal(calls[0].options.retry, false);
  assert.equal(calls[0].options.resetOnTimeout, false);
  assert.equal(service.defaultModelForOptions(options), "gpt-5.5");
});

test("model options runtime falls back to local defaults when provider read fails", async () => {
  const service = createModelOptionsRuntimeService({
    fallbackModelOptions: ["gpt-5.5", "gpt-5.4"],
    defaultModel: "gpt-5.5",
    codex: {
      request: async () => {
        const err = new Error("model/list unavailable");
        err.code = "METHOD_NOT_FOUND";
        throw err;
      },
    },
  });

  const options = await service.effectiveModelOptions({ force: true });

  assert.deepEqual(options, ["gpt-5.5", "gpt-5.4"]);
  assert.equal(service.publicStatus().source, "fallback");
  assert.equal(service.publicStatus().lastErrorCode, "method_not_found");
});

test("model options runtime normalizes safe model ids only", () => {
  assert.equal(normalizeModelOption(" gpt-5.6 "), "gpt-5.6");
  assert.equal(normalizeModelOption("gpt-5.6-sol"), "gpt-5.6-sol");
  assert.equal(normalizeModelOption("gpt 5.6"), "");
  assert.deepEqual(normalizeModelOptions(["gpt-5.6", "gpt-5.6", "bad value"]), ["gpt-5.6"]);
  assert.deepEqual(extractModelOptionsFromModelListResponse({
    data: [
      { model: "gpt-5.7-future" },
      { id: "gpt-5.6-terra" },
    ],
  }), ["gpt-5.7-future", "gpt-5.6-terra"]);
});
