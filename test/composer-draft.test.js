"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const draftStoreJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "draft-store.js"), "utf8");

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

test("composer drafts are browser-local and keyed by thread or new-thread workspace", () => {
  assert.match(draftStoreJs, /draftsKey: "codexMobileDraftsV1"/);
  assert.match(draftStoreJs, /draftTargetKey: "codexMobileDraftTargetV1"/);
  assert.match(appJs, /window\.CodexDraftStore\.createDraftStore/);
  assert.match(appJs, /function draftKeyForThread\(threadId\)/);
  assert.match(appJs, /function draftKeyForNewThread\(cwd\)/);
  assert.match(appJs, /return draftKeyForThread\(currentComposerThreadId\(\)\)/);

  const buildBody = functionBody("buildCurrentDraft");
  assert.match(buildBody, /text: composerText\(\)/);
  assert.match(buildBody, /attachments: state\.pendingAttachments\.map\(normalizeDraftAttachmentMeta\)/);
  assert.match(buildBody, /draft\.cwd = state\.selectedCwd \|\| ""/);
  assert.match(buildBody, /draft\.model = state\.newThreadModel/);
  assert.match(buildBody, /draft\.effort = state\.newThreadEffort/);
  assert.match(buildBody, /draft\.permissionMode = permission/);
  assert.match(buildBody, /if \(codexFastCommandEnabled\(\)\) draft\.fastMode = true;/);
});

test("switching targets saves the previous draft and restores the next draft", () => {
  const clearBody = functionBody("clearCurrentThreadSelection");
  assert.match(clearBody, /if \(options\.saveDraft !== false\) saveCurrentDraftNow\(\)/);
  assert.match(clearBody, /replacePendingAttachments\(\[\], \{ saveDraft: false \}\)/);

  const loadThreadBody = functionBody("loadThread");
  assert.match(loadThreadBody, /saveCurrentDraftNow\(\)/);
  assert.match(loadThreadBody, /restoreDraftForCurrentTarget\(\)/);

  const newThreadBody = functionBody("enterNewThreadDraft");
  assert.match(newThreadBody, /saveCurrentDraftNow\(\)/);
  assert.match(newThreadBody, /clearCurrentThreadSelection\(\{ saveDraft: false \}\)/);
  assert.match(newThreadBody, /restoreDraftForCurrentTarget\(\)/);

  const tileSelectBody = functionBody("setThreadTileSelectedThread");
  assert.match(tileSelectBody, /saveCurrentDraftNow\(\)/);
  assert.match(tileSelectBody, /restoreDraftForCurrentTarget\(\{ resetRuntimeWhenMissingDraft: true \}\)/);

  const tileReplaceBody = functionBody("replaceThreadTilePaneThread");
  assert.match(tileReplaceBody, /saveCurrentDraftNow\(\)/);
  assert.match(tileReplaceBody, /restoreDraftForCurrentTarget\(\{ resetRuntimeWhenMissingDraft: true \}\)/);
});

test("composer runtime selections persist without typed text", () => {
  assert.doesNotMatch(appJs, /codexFastMode:\s*localStorage\.getItem/, "Fast should not restore from a global browser flag");

  const draftStoreBody = draftStoreJs.slice(
    draftStoreJs.indexOf("function draftHasContent("),
    draftStoreJs.indexOf("function attachmentStorageKey(", draftStoreJs.indexOf("function draftHasContent(")),
  );
  assert.match(draftStoreBody, /draft\.model/);
  assert.match(draftStoreBody, /draft\.effort/);
  assert.match(draftStoreBody, /draft\.permissionMode/);
  assert.match(draftStoreBody, /draft\.fastMode === true/);

  const selectionBody = functionBody("applyRuntimeSelection");
  assert.match(selectionBody, /if \(kind === "effort"\) state\.composerEffort = selected;/);
  assert.match(selectionBody, /saveCurrentDraftNow\(\)/, "runtime selection should persist even when the composer text is empty");

  const saveBody = functionBody("saveCurrentDraftNow");
  assert.match(saveBody, /if \(state\.composerBusy\) return;/);
  assert.match(saveBody, /writeCurrentDraftToKey\(key\)/);
  assert.match(functionBody("writeCurrentDraftToKey"), /if \(draftHasContent\(draft\)\)/);

  const sendBody = functionBody("sendMessage");
  assert.match(sendBody, /setComposerText\(""\);[\s\S]*clearPendingAttachments\(\{ revokePreviewUrls: false \}\);[\s\S]*writeCurrentDraftToKey\(submittedDraftKey\)/, "send success should preserve runtime-only draft while clearing text and attachments");
  assert.doesNotMatch(sendBody, /state\.composerEffort = "";/, "send success should not immediately revert selected effort to the previous thread default");

  const fastBody = functionBody("setCodexFastCommandEnabled");
  assert.match(fastBody, /saveCurrentDraftNow\(\)/, "Fast toggle should use the existing draft save path");
  assert.match(fastBody, /clearLegacyCodexFastModeStorage\(\)/, "Fast toggle should clear the retired global flag");
  assert.doesNotMatch(fastBody, /localStorage\.setItem\(STORAGE_CODEX_FAST_MODE/, "Fast should not write a global browser flag");
  assert.doesNotMatch(appJs, /saveDraftForCurrentTarget/, "runtime controls must not call a missing draft-save helper");

  const restoreBody = functionBody("applyDraftRuntimeSelection");
  assert.match(restoreBody, /const hasDraft = Boolean\(draft && typeof draft === "object"\)/);
  assert.match(restoreBody, /state\.codexFastMode = Boolean\(draft && draft\.fastMode === true\)/);
  assert.doesNotMatch(restoreBody, /localStorage\.setItem\(STORAGE_CODEX_FAST_MODE/);
  assert.match(restoreBody, /options\.resetRuntimeWhenMissingDraft === true/, "target switching can clear stale runtime overrides when the new target has no draft");
  assert.match(restoreBody, /state\.composerModel = "";/);
  assert.match(restoreBody, /state\.composerEffort = "";/);
  assert.match(restoreBody, /state\.composerPermissionMode = "";/);

  const resetBody = functionBody("resetComposerRuntimeSelection");
  assert.match(resetBody, /state\.codexFastMode = false;/, "switching targets should clear Fast until that target draft is restored");

  const loadThreadBody = functionBody("loadThread");
  assert.match(loadThreadBody, /state\.currentThread = mergeThreadPreservingVisibleItems/);
  assert.match(loadThreadBody, /restoreDraftForCurrentTarget\(\);[\s\S]*renderComposerSettings\(\)/, "thread load should restore persisted runtime selections");
});

test("draft attachments use IndexedDB and are cleared only after a successful send", () => {
  assert.match(draftStoreJs, /indexedDBRef\.open\(config\.dbName,\s*config\.dbVersion\)/);
  assert.match(appJs, /function storeDraftAttachment\(/);
  assert.match(appJs, /function loadDraftAttachment\(/);
  assert.match(appJs, /function deleteDraftAttachments\(/);

  const addBody = functionBody("addAttachmentFiles");
  assert.match(addBody, /saveDraftAttachmentFiles\(draftKey, addedItems\)/);
  assert.match(addBody, /scheduleCurrentDraftSave\(\)/);

  const sendBody = functionBody("sendMessage");
  assert.match(sendBody, /const submittedDraftKey = currentDraftKey\(\)/);
  assert.match(sendBody, /const threadTaskCardCommand = isThreadTaskCardCommandText\(text\)/);
  assert.match(sendBody, /await sendThreadTaskCardCommand\(text\)/);
  assert.match(functionBody("sendThreadTaskCardCommand"), /const outboundText = buildThreadTaskCardDraftRequestText\(text, targetThread\)/);
  assert.match(sendBody, /writeCurrentDraftToKey\(submittedDraftKey\)/);
  assert.doesNotMatch(sendBody, /clearDraftForKey\(submittedDraftKey\)/);

  const newSendBody = functionBody("sendNewThreadMessage");
  assert.match(newSendBody, /const submittedDraftKey = currentDraftKey\(\)/);
  assert.match(newSendBody, /const submittedEffort = newThreadSelectedEffort\(\)/);
  assert.match(newSendBody, /clearDraftForKey\(submittedDraftKey\)/);
  assert.match(newSendBody, /state\.composerEffort = submittedEffort \|\| "";/);
  assert.match(newSendBody, /writeCurrentDraftToKey\(draftKeyForThread\(threadId\)\)/);
});
