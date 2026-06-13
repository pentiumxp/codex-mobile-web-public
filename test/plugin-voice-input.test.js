"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const voiceInput = require("../public/plugin-voice-input");

const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const swJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "sw.js"), "utf8");
const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");

function functionBody(name) {
  let start = appJs.indexOf(`function ${name}(`);
  if (start < 0) start = appJs.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const bodyStart = appJs.indexOf(") {", start) + 2;
  assert.notEqual(bodyStart, 1, `missing function body ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < appJs.length; index += 1) {
    const char = appJs[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return appJs.slice(bodyStart + 1, index);
  }
  throw new Error(`could not parse function ${name}`);
}

test("voice input helper builds Home AI embedded-plugin protocol messages", () => {
  const capability = voiceInput.capabilityStateMessage({
    requestId: "req-1",
    writable: true,
    composerId: "thread-composer",
    threadId: "thread-123",
    draftId: "thread:thread-123",
    actions: { append_text: true, replace_draft: true, submit: true },
    maxChars: 9000,
  });
  assert.equal(capability.type, "voice_input.capability_state");
  assert.equal(capability.version, 1);
  assert.equal(capability.pluginId, "codex-mobile");
  assert.equal(capability.requestId, "req-1");
  assert.equal(capability.writable, true);
  assert.deepEqual(capability.actions, ["append_text", "replace_draft"]);
  assert.deepEqual(capability.composer, {
    writable: true,
    composerId: "thread-composer",
    threadId: "thread-123",
    draftId: "thread:thread-123",
    maxChars: 9000,
  });

  const start = voiceInput.startRequestMessage(capability);
  assert.equal(start.type, "voice_input.start_request");
  assert.equal(start.capability.type, "voice_input.capability_state");
  assert.equal(start.composerId, "thread-composer");

  const insert = voiceInput.insertResultMessage({
    requestId: "req-2",
    voiceSessionId: "voice-1",
    ok: true,
    draftId: "thread:thread-123",
  });
  assert.equal(insert.type, "voice_input.insert_result");
  assert.equal(insert.voiceSessionId, "voice-1");
  assert.equal(insert.ok, true);

  const commit = voiceInput.commitResultMessage({
    voiceSessionId: "voice-1",
    threadId: "thread-123",
    finalText: "最终发送文本",
  });
  assert.equal(commit.type, "voice_input.commit_result");
  assert.equal(commit.finalText, "最终发送文本");
});

test("voice input bridge is limited to Hermes embed mode and uses plugin scripts", () => {
  assert.match(indexHtml, /<script src="\/plugin-voice-input\.js"><\/script>\s*<script src="\/build-refresh-policy\.js"><\/script>\s*<script src="\/app\.js"><\/script>/);
  assert.match(swJs, /"\/plugin-voice-input\.js"/);
  assert.match(appJs, /"\/plugin-voice-input\.js"/);
  assert.match(functionBody("pluginVoiceInputComposerWritable"), /if \(!isHermesEmbedMode\(\)\) return false;/);
  assert.match(functionBody("pluginVoiceInputActiveTurnHoldAvailable"), /if \(!isHermesEmbedMode\(\)\) return false;/);
  assert.match(functionBody("pluginVoiceInputGestureAvailable"), /if \(!isHermesEmbedMode\(\)\) return false;/);
  assert.match(functionBody("pluginVoiceInputGestureAvailable"), /if \(pluginVoiceInputActiveTurnHoldAvailable\(\)\) return true;/);
  assert.match(functionBody("handlePluginVoiceInputMessage"), /pluginVoiceInputParentOriginAllowed\(event\)/);
  assert.match(functionBody("handlePluginVoiceInputMessage"), /payload\.pluginId && String\(payload\.pluginId\) !== "codex-mobile"/);
  assert.match(functionBody("updateComposerControls"), /const voiceGestureAvailable = pluginVoiceInputGestureAvailable\(\)/);
  assert.match(functionBody("updateComposerControls"), /!hasContent && !voiceGestureAvailable/);
  assert.match(functionBody("sendMessage"), /commitPluginVoiceInputSessionsAfterSend\(submittedDraftKey, text/);
  assert.match(functionBody("sendNewThreadMessage"), /commitPluginVoiceInputSessionsAfterSend\(submittedDraftKey, text/);
});

test("send button long press delegates recording to Home AI only after threshold", () => {
  assert.match(functionBody("handlePluginVoiceInputSendPointerDown"), /event\.preventDefault\(\)/);
  assert.match(functionBody("handlePluginVoiceInputSendPointerDown"), /event\.stopPropagation\(\)/);
  assert.match(functionBody("handlePluginVoiceInputSendPointerDown"), /setTimeout\(\(\) => \{/);
  assert.match(functionBody("handlePluginVoiceInputSendPointerDown"), /PLUGIN_VOICE_INPUT_LONG_PRESS_MS/);
  assert.match(functionBody("handlePluginVoiceInputSendPointerDown"), /pluginVoiceInputApi\.startRequestMessage/);
  assert.match(functionBody("handlePluginVoiceInputSendPointerUp"), /pluginVoiceInputApi\.stopRequestMessage/);
  assert.match(functionBody("handlePluginVoiceInputSendPointerUp"), /event\.stopImmediatePropagation\(\)/);
  assert.match(functionBody("handlePluginVoiceInputSendClick"), /event\.stopImmediatePropagation\(\)/);
  assert.match(appJs, /sendButton\.addEventListener\("pointerdown", handlePluginVoiceInputSendPointerDown\)/);
  assert.match(appJs, /sendButton\.addEventListener\("pointerup", handlePluginVoiceInputSendPointerUp\);[\s\S]*sendButton\.addEventListener\("pointerup", requestComposerSubmitFromButton\)/);
});

test("embedded active-turn stop button is not rendered as selectable text", () => {
  assert.match(functionBody("updateComposerControls"), /setComposerActionButtonLabel\(sendButton, "Stop", \{ proxy: isHermesEmbedMode\(\) \}\)/);
  assert.match(functionBody("setComposerActionButtonLabel"), /button\.textContent = "";/);
  assert.match(functionBody("setComposerActionButtonLabel"), /button\.dataset\.visualLabel = text;/);
  assert.match(functionBody("setComposerActionButtonLabel"), /button\.classList\.toggle\("plugin-voice-input-label-proxy", useProxy\)/);
  assert.match(stylesCss, /#sendMessage\.plugin-voice-input-gesture,\s*#sendMessage\.plugin-voice-input-gesture::before,\s*#sendMessage\.plugin-voice-input-gesture::after/);
  assert.match(stylesCss, /#sendMessage\.interrupt-mode\.plugin-voice-input-label-proxy::before/);
  assert.match(stylesCss, /-webkit-touch-callout: none !important;/);
});
