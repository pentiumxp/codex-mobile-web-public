"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const publicAppShell = fs.readFileSync(path.join(root, "public", "app-shell-runtime.js"), "utf8");
const nativeAppShell = fs.readFileSync(path.join(root, "frontend", "native", "app-shell-runtime.mjs"), "utf8");
const publicRuntimeSettings = fs.readFileSync(path.join(root, "public", "runtime-settings.js"), "utf8");
const nativeRuntimeSettings = fs.readFileSync(path.join(root, "frontend", "native", "runtime-settings.mjs"), "utf8");

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

for (const [label, source] of [["public", publicAppShell], ["native", nativeAppShell]]) {
  test(`${label} app shell refreshes model options without full app refresh`, () => {
    assert.match(source, /applyRuntimeModelOptionsConfig\(config, "startup", \{ render: false, saveDraft: false \}\)/);
    assert.match(source, /refreshModelOptionsFromPublicConfig\(\{ source: "composer-model-menu", force: true \}\)/);
    assert.match(source, /refreshModelOptionsFromPublicConfig\(\{ source: "settings-open", force: true \}\)/);
    assert.match(source, /scheduleModelOptionsRefresh\(250, \{ source: "visibility", force: true \}\)/);
    assert.match(source, /scheduleModelOptionsRefresh\(260, \{ source: "pageshow", force: true \}\)/);
    assert.match(source, /scheduleModelOptionsRefresh\(650, \{ source: "focus" \}\)/);
    assert.match(source, /modelOptionsCheck=\$\{Date\.now\(\)\}/);
    assert.match(source, /sameClientBuildId: String\(config\.clientBuildId \|\| ""\) === String\(CLIENT_BUILD_ID \|\| ""\)/);
    assert.match(source, /openComposerRuntimeMenu\("model", modelControl\)/);

    const refreshBody = sourceFunctionBody(source, "refreshModelOptionsFromPublicConfig");
    assert.doesNotMatch(refreshBody, /refreshPageForNewBuild|pageRefreshAvailable|location\.reload|window\.location/);
    const applyBody = sourceFunctionBody(source, "applyRuntimeModelOptionsConfig");
    assert.doesNotMatch(applyBody, /refreshPageForNewBuild|pageRefreshAvailable|location\.reload|window\.location/);
  });
}

for (const [label, source] of [["public", publicRuntimeSettings], ["native", nativeRuntimeSettings]]) {
  test(`${label} runtime settings exports model option refresh state contract`, () => {
    assert.match(source, /applyModelOptionsRefresh/);
    assert.match(source, /legalModelValues/);
    assert.match(source, /target\.composerModel = ""/);
    assert.match(source, /target\.newThreadModel = fallback/);
  });
}
