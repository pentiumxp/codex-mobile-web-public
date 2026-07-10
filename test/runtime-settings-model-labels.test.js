"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const publicRuntimeSettings = require("../public/runtime-settings");

test("public runtime settings labels dynamic GPT model ids", () => {
  assert.equal(publicRuntimeSettings.labelForModel("gpt-5.6"), "GPT-5.6");
  assert.equal(publicRuntimeSettings.compactLabelForModel("gpt-5.6"), "5.6");
  assert.equal(publicRuntimeSettings.labelForModel("gpt-5.6-sol"), "GPT-5.6 Sol");
  assert.equal(publicRuntimeSettings.compactLabelForModel("gpt-5.7-future"), "5.7 Future");
});

test("native runtime settings labels dynamic GPT model ids", async () => {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, "..", "frontend", "native", "runtime-settings.mjs")).href;
  const nativeRuntimeSettings = await import(moduleUrl);

  assert.equal(nativeRuntimeSettings.labelForModel("gpt-5.6"), "GPT-5.6");
  assert.equal(nativeRuntimeSettings.compactLabelForModel("gpt-5.6"), "5.6");
  assert.equal(nativeRuntimeSettings.labelForModel("gpt-5.6-terra"), "GPT-5.6 Terra");
  assert.equal(nativeRuntimeSettings.compactLabelForModel("gpt-5.7-future"), "5.7 Future");
});
