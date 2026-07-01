"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { readFrontendSources } = require("./frontend-source-helper");

const appJs = readFrontendSources(path.resolve(__dirname, ".."));
const composerRuntimeJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "composer-runtime.js"), "utf8");
const threadListRuntimeJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "thread-list-runtime.js"), "utf8");
const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");

function functionBodyFrom(source, name) {
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

function functionBody(name) {
  return functionBodyFrom(appJs, name);
}

function composerRuntimeBody(name) {
  return functionBodyFrom(composerRuntimeJs, name);
}

function functionSourceFrom(source, name) {
  let start = source.indexOf(`function ${name}(`);
  if (start < 0) start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const body = functionBodyFrom(source, name);
  const open = source.indexOf(") {", start) + 2;
  assert.notEqual(open, 1, `missing function body ${name}`);
  return `${source.slice(start, open + 1)}${body}}`;
}

function functionSource(name) {
  return functionSourceFrom(appJs, name);
}

function evaluatedAndroidComposerGestureHarness(options = {}) {
  const sources = [
    "messageInputKeyboardVisible",
    "shouldRecoverMessageInputKeyboard",
    "recoverMessageInputKeyboardFromGesture",
    "messageInputCanEnableForNativeGesture",
    "releaseStaleAndroidMessageInputFocusBeforeNativeTap",
    "prepareMessageInputForNativeGesture",
  ].map((name) => functionSourceFrom(composerRuntimeJs, name)).join("\n");
  return Function("options", `
let blurCount = 0;
let focusCount = 0;
let disabledCount = 0;
const state = {
  composerBusy: false,
  composerComposing: Boolean(options.composerComposing),
  attachmentProcessingCount: 0,
  newThreadDraft: true,
  currentThreadId: "thread-id",
  currentThread: { mobileLoading: false, mobileLoadError: false },
  messageInputPointerWasFocused: false,
  messageInputKeyboardRecoveryAt: 0,
};
const input = {
  contentEditable: options.disabled ? "false" : "true",
  tabIndex: 0,
  attrs: { "aria-disabled": options.disabled ? "true" : "false" },
  classList: { contains() { return false; } },
  getAttribute(name) { return this.attrs[name] || ""; },
  setAttribute(name, value) { this.attrs[name] = String(value); },
  blur() { blurCount += 1; document.activeElement = null; },
  focus() { focusCount += 1; document.activeElement = input; },
  contains(node) { return node === input || Boolean(node && node.insideInput); },
};
const document = { activeElement: options.initialFocused === false ? null : input };
const window = { setTimeout(fn) { fn(); } };
function $(id) { return id === "messageInput" ? input : null; }
function isAndroidBrowser() { return options.android !== false; }
function isHermesEmbedMode() { return Boolean(options.hermes); }
function viewportState() {
  return { keyboardShrunk: Boolean(options.keyboardShrunk), hostKeyboardVisible: Boolean(options.hostKeyboardVisible) };
}
function isKeyboardEditableElement(el) { return el === input; }
function setMessageInputDisabled(disabled) {
  disabledCount += 1;
  input.contentEditable = disabled ? "false" : "true";
  input.attrs["aria-disabled"] = disabled ? "true" : "false";
}
function focusMessageInput() {
  input.focus();
  return true;
}
${sources}
return {
  input,
  state,
  prepare: prepareMessageInputForNativeGesture,
  recover: recoverMessageInputKeyboardFromGesture,
  release: () => releaseStaleAndroidMessageInputFocusBeforeNativeTap(input),
  active: () => document.activeElement === input,
  blurCount: () => blurCount,
  focusCount: () => focusCount,
  disabledCount: () => disabledCount,
};
`)(options);
}

test("new-thread draft renders model, reasoning, and permission controls", () => {
  assert.match(appJs, /id="composerModelControl"|composerModelControl/, "composer should include a model control");
  assert.match(appJs, /id="composerEffortControl"|composerEffortControl/, "composer should include a reasoning control");
  assert.match(appJs, /id="composerPermissionControl"|composerPermissionControl/, "composer should include a permission control");

  const body = functionBody("renderNewThreadDraft");
  assert.doesNotMatch(body, /new-thread-settings/, "new-thread page should not duplicate runtime settings in the page body");
  assert.match(body, /不指定 Workspace/);
  assert.match(body, /将按 Codex App 的项目外聊天方式创建/);
  assert.match(functionBodyFrom(threadListRuntimeJs, "newThreadWorkspaceOptionsHtml"), /data-new-thread-workspace=""/);
  assert.match(functionBodyFrom(threadListRuntimeJs, "newThreadWorkspaceOptionsHtml"), /projectless-thread|项目外聊天/);
});

test("new-thread draft can send without selecting a workspace", () => {
  const body = composerRuntimeBody("updateComposerControls");

  assert.match(body, /hasNewThreadDraft,/);
  assert.match(body, /threadTileStatePolicy\.composerActionControlPlan\(\{/);
  assert.doesNotMatch(body, /hasNewThreadDraft && state\.selectedCwd/);
});

test("new-thread message submission includes selected runtime settings", () => {
  const body = composerRuntimeBody("sendNewThreadMessage");

  assert.match(body, /const submittedModel = newThreadSelectedModel\(\)/);
  assert.match(body, /const submittedEffort = newThreadSelectedEffort\(\)/);
  assert.match(body, /const submittedPermissionMode = newThreadSelectedPermissionMode\(\)/);
  assert.match(body, /body\.append\("model",\s*submittedModel\)/);
  assert.match(body, /body\.append\("effort",\s*submittedEffort\)/);
  assert.match(body, /body\.append\("permissionMode",\s*submittedPermissionMode\)/);
  assert.match(body, /state\.composerEffort = submittedEffort \|\| "";/);
  assert.match(body, /writeCurrentDraftToKey\(draftKeyForThread\(threadId\)\)/);
});

test("new-thread permission defaults come from config-derived full mode, not option order", () => {
  assert.match(functionBody("newThreadSelectedPermissionMode"), /defaultValue:\s*defaultNewThreadPermissionMode\(\)/);
  assert.match(functionBody("defaultNewThreadPermissionMode"), /state\.defaultPermissionMode/);
  assert.match(appJs, /state\.defaultPermissionMode = effectiveComposerPermissionMode\(config\.defaultPermissionMode\) \|\| "full";/);
  assert.match(appJs, /state\.newThreadPermissionMode = effectiveComposerPermissionMode\(state\.newThreadPermissionMode\)\s*\|\|\s*defaultNewThreadPermissionMode\(\);/);
  assert.doesNotMatch(appJs, /state\.newThreadPermissionMode = normalizePermissionModeValue\(state\.newThreadPermissionMode\)\s*\|\|\s*normalizePermissionModeValue\(state\.permissionModeOptions\[0\]\)/);
});

test("existing-thread message submission includes selected runtime settings", () => {
  const body = composerRuntimeBody("sendMessage");

  assert.match(body, /body\.append\("model",\s*selectedComposerModel\(\)\)/);
  assert.match(body, /body\.append\("effort",\s*selectedComposerEffort\(\)\)/);
  assert.match(body, /body\.append\("permissionMode",\s*selectedComposerPermissionMode\(\)\)/);
});

test("composer input preserves Android IME composition connection", () => {
  const setter = composerRuntimeBody("setMessageInputDisabled");
  const focusHelper = composerRuntimeBody("focusMessageInput");

  assert.match(appJs, /composerComposing: false/);
  assert.match(appJs, /messageInputPointerWasFocused: false/);
  assert.match(appJs, /messageInputKeyboardRecoveryAt: 0/);
  assert.match(composerRuntimeJs, /function shouldKeepAndroidMessageInputEditable\(disabled, el\)/);
  assert.match(composerRuntimeBody("shouldKeepAndroidMessageInputEditable"), /!disabled \|\| !isAndroidBrowser\(\)/);
  assert.match(composerRuntimeBody("shouldKeepAndroidMessageInputEditable"), /messageInputCanEnableForNativeGesture\(\)/);
  assert.match(composerRuntimeBody("shouldKeepAndroidMessageInputEditable"), /state\.composerComposing \|\| document\.activeElement === el/);
  assert.match(setter, /const alreadyApplied = currentContentEditable === nextContentEditable/);
  assert.match(setter, /if \(alreadyApplied\) return;/);
  assert.match(setter, /const keepAndroidEditorConnection = shouldKeepAndroidMessageInputEditable\(disabled, el\);/);
  assert.match(setter, /const nextContentEditable = disabled && !keepAndroidEditorConnection \? "false" : "true";/);
  assert.match(setter, /const preserveImeConnection = \(state\.composerComposing \|\| keepAndroidEditorConnection\)/);
  assert.match(setter, /if \(!preserveImeConnection && currentContentEditable !== nextContentEditable\)/);
  assert.match(composerRuntimeJs, /function placeMessageInputCaretAtEnd\(input\)/);
  assert.match(focusHelper, /setMessageInputDisabled\(false\)/);
  assert.match(focusHelper, /options\.resetActiveFocus[\s\S]*document\.activeElement === input[\s\S]*\(!isAndroidBrowser\(\) \|\| options\.allowAndroidActiveFocusReset\)/);
  assert.match(focusHelper, /input\.focus\(\{ preventScroll: true \}\)/);
  assert.match(focusHelper, /if \(options\.moveCaretToEnd\) placeMessageInputCaretAtEnd\(input\)/);
  assert.match(indexHtml, /id="messageInput"[^>]*inputmode="text"[^>]*enterkeyhint="send"/);
  assert.match(composerRuntimeJs, /function messageInputKeyboardVisible\(\)/);
  assert.match(composerRuntimeBody("shouldRecoverMessageInputKeyboard"), /if \(!isAndroidBrowser\(\) && !isHermesEmbedMode\(\)\) return false;/);
  assert.doesNotMatch(composerRuntimeBody("shouldRecoverMessageInputKeyboard"), /if \(isAndroidBrowser\(\)\) return false;/);
  assert.match(composerRuntimeJs, /function recoverMessageInputKeyboardFromGesture\(\)/);
  assert.match(composerRuntimeBody("recoverMessageInputKeyboardFromGesture"), /state\.messageInputPointerWasFocused = false/);
  assert.doesNotMatch(composerRuntimeBody("recoverMessageInputKeyboardFromGesture"), /if \(isAndroidBrowser\(\)\) return false;/);
  assert.match(composerRuntimeJs, /function releaseStaleAndroidMessageInputFocusBeforeNativeTap\(input\)/);
  assert.match(composerRuntimeBody("releaseStaleAndroidMessageInputFocusBeforeNativeTap"), /document\.activeElement === input[\s\S]*return false/);
  assert.match(composerRuntimeBody("releaseStaleAndroidMessageInputFocusBeforeNativeTap"), /input\.blur\(\)/);
  assert.match(composerRuntimeJs, /function messageInputCanEnableForNativeGesture\(\)/);
  assert.match(composerRuntimeBody("messageInputCanEnableForNativeGesture"), /state\.composerBusy \|\| state\.attachmentProcessingCount > 0/);
  assert.match(composerRuntimeBody("messageInputCanEnableForNativeGesture"), /state\.newThreadDraft/);
  assert.match(composerRuntimeBody("prepareMessageInputForNativeGesture"), /state\.messageInputPointerWasFocused = document\.activeElement === input/);
  assert.match(composerRuntimeBody("prepareMessageInputForNativeGesture"), /if \(!input \|\| !isAndroidBrowser\(\)\) return;/);
  assert.match(composerRuntimeBody("prepareMessageInputForNativeGesture"), /messageInputCanEnableForNativeGesture\(\)/);
  assert.match(composerRuntimeBody("prepareMessageInputForNativeGesture"), /setMessageInputDisabled\(false\)/);
  assert.match(composerRuntimeBody("prepareMessageInputForNativeGesture"), /releaseStaleAndroidMessageInputFocusBeforeNativeTap\(input\)/);
  assert.doesNotMatch(composerRuntimeBody("prepareMessageInputForNativeGesture"), /focusMessageInput|preventDefault/);
  assert.match(appJs, /addEventListener\("pointerdown", prepareMessageInputForNativeGesture\)/);
  assert.match(appJs, /addEventListener\("pointerup", recoverMessageInputKeyboardFromGesture\)/);
  assert.match(appJs, /addEventListener\("click", recoverMessageInputKeyboardFromGesture\)/);
  assert.match(composerRuntimeBody("recoverMessageInputKeyboardFromGesture"), /isAndroidBrowser\(\) \? \{[\s\S]*retry: true[\s\S]*\} : \{[\s\S]*resetActiveFocus: true[\s\S]*allowAndroidActiveFocusReset: true/);
  assert.match(appJs, /addEventListener\("compositionstart", \(\) => \{[\s\S]*state\.composerComposing = true;/);
  assert.match(appJs, /addEventListener\("compositionend", \(event\) => \{[\s\S]*state\.composerComposing = false;/);
  assert.match(appJs, /if \(state\.composerComposing \|\| event\.isComposing\) return;/);
});

test("Android focused composer pointerdown does not blur the native IME connection", () => {
  const harness = evaluatedAndroidComposerGestureHarness();

  assert.equal(harness.active(), true);
  harness.prepare({ pointerType: "touch", target: harness.input });

  assert.equal(harness.blurCount(), 0);
  assert.equal(harness.active(), true);
  assert.equal(harness.state.messageInputPointerWasFocused, true);
  assert.equal(harness.recover(), true);
  assert.equal(harness.blurCount(), 0);
  assert.equal(harness.focusCount(), 1);
});

test("Android composer pointerdown keeps focus when host reports keyboard visible", () => {
  const harness = evaluatedAndroidComposerGestureHarness({ hostKeyboardVisible: true });

  harness.prepare({ pointerType: "touch", target: harness.input });

  assert.equal(harness.blurCount(), 0);
  assert.equal(harness.active(), true);
  assert.equal(harness.recover(), false);
  assert.equal(harness.focusCount(), 0);
});

test("quota display falls back only to a compatible account quota group", () => {
  const body = functionBody("rateLimitsForQuota");

  assert.match(body, /state\.rateLimitsByModel\[modelKey\]/, "quota should prefer exact model cache first");
  assert.match(body, /isRateLimitCompatibleWithModel\(state\.rateLimits,\s*modelKey\)/, "quota should fall back only within the same quota group");
});

test("quota UI ignores source-less rate-limit notifications", () => {
  const body = functionBody("applyNotification");

  assert.match(body, /method === "account\/rateLimits\/updated"/);
  assert.doesNotMatch(body, /rememberRateLimits\(params\.rateLimits/, "source-less quota notifications should not overwrite composer quota");
});

test("quota UI clears stale cache when config has no valid quota snapshot", () => {
  const body = functionBody("rememberRateLimitsFromConfig");

  assert.match(body, /hasRateLimitSnapshot\(config\.rateLimits \|\| null,\s*config\.rateLimitsByModel \|\| null\)/);
  assert.match(appJs, /function shouldKeepStoredRateLimitsOnEmptyConfig\(\)[\s\S]*isHermesEmbedMode\(\)[\s\S]*hasRateLimitSnapshot\(state\.rateLimits,\s*state\.rateLimitsByModel\)/);
  assert.match(body, /else if \(shouldKeepStoredRateLimitsOnEmptyConfig\(\)\)[\s\S]*renderQuotaUsage\(\)/);
  assert.match(body, /clearStoredRateLimits\(\)/);
});

test("quota grouping treats Spark as independent and other Codex models as shared", () => {
  const body = functionBody("rateLimitModelKeys");

  assert.match(body, /limitId === "codex-bengalfox"[\s\S]*gpt-5\.3-codex-spark/, "Spark quota should map to the Spark model");
  assert.match(body, /limitId === "codex"[\s\S]*!isSparkModelKey\(modelKey\)/, "Codex quota should map to non-Spark models");
});
