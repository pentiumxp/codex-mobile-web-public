"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const composerRuntime = require(path.join(root, "public", "composer-runtime.js"));
const composerRuntimeJs = fs.readFileSync(path.join(root, "public", "composer-runtime.js"), "utf8");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const swJs = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
const serverRuntimeUtilsJs = fs.readFileSync(path.join(root, "services", "runtime", "server-runtime-utils.js"), "utf8");

function sourceFunctionBody(source, name) {
  let start = source.indexOf(`function ${name}(`);
  if (start < 0) start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const bodyStart = source.indexOf(") {", start) + 2;
  assert.notEqual(bodyStart, 1, `missing function body ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }
  throw new Error(`could not parse function ${name}`);
}

function appBody(name) {
  return sourceFunctionBody(appJs, name);
}

function runtimeBody(name) {
  return sourceFunctionBody(composerRuntimeJs, name);
}

test("composer runtime owns composer behavior while app.js keeps glue wrappers", () => {
  assert.equal(typeof composerRuntime.createComposerRuntime, "function");
  const runtime = composerRuntime.createComposerRuntime({});

  for (const name of [
    "sendMessage",
    "sendNewThreadMessage",
    "sendThreadTaskCardCommand",
    "renderComposerSettings",
    "updateComposerControls",
    "addAttachmentFiles",
    "requestAttachmentPickerFromButton",
    "interruptActiveTurn",
  ]) {
    assert.equal(typeof runtime[name], "function", `${name} should be exported`);
    assert.match(appBody(name), new RegExp(`return composerRuntime\\.${name}\\(\\.\\.\\.args\\);`));
    assert.doesNotMatch(runtimeBody(name), /composerRuntime\./);
  }

  assert.match(appJs, /const composerRuntimeApi = window\.CodexComposerRuntime/);
  assert.match(appJs, /const composerRuntime = composerRuntimeApi\.createComposerRuntime\(\{/);
  assert.match(composerRuntimeJs, /module\.exports = api/);
});

test("composer runtime is created after its constant dependencies", () => {
  const runtimeCreateIndex = appJs.indexOf("const composerRuntime = composerRuntimeApi.createComposerRuntime({");
  assert.notEqual(runtimeCreateIndex, -1);
  for (const name of [
    "MESSAGE_INPUT_MIN_HEIGHT_PX",
    "MESSAGE_INPUT_MAX_HEIGHT_PX",
  ]) {
    const declarationIndex = appJs.indexOf(`const ${name}`);
    assert.notEqual(declarationIndex, -1, `missing ${name}`);
    assert.ok(declarationIndex < runtimeCreateIndex, `${name} must be declared before composer runtime creation`);
  }
});

test("composer runtime is part of the v615 static shell", () => {
  assert.match(indexHtml, /<script src="\/composer-runtime\.js"><\/script>/);
  assert.match(swJs, /"\/composer-runtime\.js"/);
  assert.match(appJs, /"\/composer-runtime\.js"/);
  assert.match(serverRuntimeUtilsJs, /"composer-runtime\.js"/);
  assert.match(appJs, /CLIENT_BUILD_ID = "0\.1\.11\|codex-mobile-shell-v615"/);
  assert.match(swJs, /CACHE_NAME = "codex-mobile-shell-v615"/);
});
