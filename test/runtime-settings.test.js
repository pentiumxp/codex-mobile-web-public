"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const runtimeSettings = require(path.resolve(__dirname, "..", "public", "runtime-settings.js"));

test("runtime settings normalize option lists without duplicates or blanks", () => {
  assert.deepEqual(runtimeSettings.normalizeOptionList(["", "gpt-5.5", " gpt-5.5 ", "gpt-5.4"]), [
    "gpt-5.5",
    "gpt-5.4",
  ]);
});

test("runtime settings label known model, effort, and permission values", () => {
  assert.equal(runtimeSettings.labelForModel("gpt-5.3-codex-spark"), "GPT-5.3 Codex Spark");
  assert.equal(runtimeSettings.compactLabelForModel("gpt-5.3-codex-spark"), "5.3 Spark");
  assert.equal(runtimeSettings.labelForEffort("xhigh"), "XHigh");
  assert.equal(runtimeSettings.labelForPermissionMode("full"), "完全访问权限");
  assert.equal(runtimeSettings.titleForPermissionMode("custom"), "自定义 (config.toml)");
});

test("runtime settings normalize permission aliases used by app-server modes", () => {
  assert.equal(runtimeSettings.normalizePermissionModeValue("full-access"), "full");
  assert.equal(runtimeSettings.normalizePermissionModeValue("workspace-write"), "auto");
  assert.equal(runtimeSettings.normalizePermissionModeValue("config.toml"), "custom");
});

test("runtime settings pick new-thread selections from pending value, default, then options", () => {
  assert.equal(runtimeSettings.selectedNewThreadModel({
    selected: "",
    defaultValue: "gpt-5.5",
    options: ["gpt-5.4"],
  }), "gpt-5.5");
  assert.equal(runtimeSettings.selectedNewThreadEffort({
    selected: " high ",
    defaultValue: "medium",
    options: ["low"],
  }), "high");
  assert.equal(runtimeSettings.selectedNewThreadPermission({
    selected: "",
    defaultValue: "full",
    options: ["auto"],
  }), "full");
  assert.equal(runtimeSettings.selectedNewThreadPermission({
    selected: "",
    options: ["auto"],
  }), "auto");
  assert.equal(runtimeSettings.selectedNewThreadPermission({
    selected: "",
    options: [],
  }), "full");
});
