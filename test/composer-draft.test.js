"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");

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
  assert.match(appJs, /const STORAGE_DRAFTS = "codexMobileDraftsV1"/);
  assert.match(appJs, /const STORAGE_DRAFT_TARGET = "codexMobileDraftTargetV1"/);
  assert.match(appJs, /function draftKeyForThread\(threadId\)/);
  assert.match(appJs, /function draftKeyForNewThread\(cwd\)/);
  assert.match(appJs, /return draftKeyForThread\(state\.currentThreadId\)/);

  const buildBody = functionBody("buildCurrentDraft");
  assert.match(buildBody, /text: composerText\(\)/);
  assert.match(buildBody, /attachments: state\.pendingAttachments\.map\(normalizeDraftAttachmentMeta\)/);
  assert.match(buildBody, /if \(state\.newThreadDraft\) draft\.cwd = state\.selectedCwd \|\| ""/);
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
});

test("draft attachments use IndexedDB and are cleared only after a successful send", () => {
  assert.match(appJs, /indexedDB\.open\(DRAFT_DB_NAME,\s*DRAFT_DB_VERSION\)/);
  assert.match(appJs, /function storeDraftAttachment\(/);
  assert.match(appJs, /function loadDraftAttachment\(/);
  assert.match(appJs, /function deleteDraftAttachments\(/);

  const addBody = functionBody("addAttachmentFiles");
  assert.match(addBody, /saveDraftAttachmentFiles\(draftKey, addedItems\)/);
  assert.match(addBody, /scheduleCurrentDraftSave\(\)/);

  const sendBody = functionBody("sendMessage");
  assert.match(sendBody, /const submittedDraftKey = currentDraftKey\(\)/);
  assert.match(sendBody, /clearDraftForKey\(submittedDraftKey\)/);

  const newSendBody = functionBody("sendNewThreadMessage");
  assert.match(newSendBody, /const submittedDraftKey = currentDraftKey\(\)/);
  assert.match(newSendBody, /clearDraftForKey\(submittedDraftKey\)/);
});
