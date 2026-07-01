"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { readFrontendSources } = require("./frontend-source-helper");

const root = path.resolve(__dirname, "..");
const composerRuntime = require(path.join(root, "public", "composer-runtime.js"));
const composerRuntimeJs = fs.readFileSync(path.join(root, "public", "composer-runtime.js"), "utf8");
const composerBridgeRuntimeJs = fs.readFileSync(path.join(root, "public", "composer-bridge-runtime.js"), "utf8");
const appJs = readFrontendSources(root);
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const swJs = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
const shellManifest = JSON.parse(fs.readFileSync(path.join(root, "public", "shell-asset-manifest.json"), "utf8"));
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
  return sourceFunctionBody(composerBridgeRuntimeJs, name);
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

  assert.match(appJs, /(?:const|var) composerRuntimeApi = window\.CodexComposerRuntime/);
  assert.match(appJs, /composerRuntime = composerRuntimeApi\.createComposerRuntime\(\{/);
  assert.match(composerRuntimeJs, /module\.exports = api/);
});

test("composer runtime is created after its constant dependencies", () => {
  const runtimeCreateIndex = appJs.indexOf("composerRuntime = composerRuntimeApi.createComposerRuntime({");
  assert.notEqual(runtimeCreateIndex, -1);
  for (const name of [
    "MESSAGE_INPUT_MIN_HEIGHT_PX",
    "MESSAGE_INPUT_MAX_HEIGHT_PX",
  ]) {
    let declarationIndex = appJs.indexOf(`const ${name}`);
    if (declarationIndex === -1) declarationIndex = appJs.indexOf(`var ${name}`);
    assert.notEqual(declarationIndex, -1, `missing ${name}`);
    assert.ok(declarationIndex < runtimeCreateIndex, `${name} must be declared before composer runtime creation`);
  }
});

test("composer runtime is part of the current static shell", () => {
  assert.match(indexHtml, /<script src="\/composer-runtime\.js"><\/script>/);
  assert.ok(shellManifest.precacheAssets.includes("/composer-runtime.js"));
  assert.match(appJs, /"\/composer-runtime\.js"/);
  assert.ok(shellManifest.hashAssets.includes("/composer-runtime.js"));
  assert.match(swJs, /shell-asset-manifest\.js/);
  assert.match(serverRuntimeUtilsJs, /shell-asset-manifest\.json/);
  assert.equal(shellManifest.clientBuildId, "0.1.11|codex-mobile-shell-v623");
  assert.equal(shellManifest.shellCacheName, "codex-mobile-shell-v623");
});
