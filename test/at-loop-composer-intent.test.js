"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const composerRuntime = require(path.join(root, "public", "composer-runtime.js"));
const composerRuntimeJs = fs.readFileSync(path.join(root, "public", "composer-runtime.js"), "utf8");
const composerBridgeRuntimeJs = fs.readFileSync(path.join(root, "public", "composer-bridge-runtime.js"), "utf8");
const appShellRuntimeJs = fs.readFileSync(path.join(root, "public", "app-shell-runtime.js"), "utf8");

function functionBody(source, name) {
  let start = source.indexOf(`async function ${name}(`);
  if (start < 0) start = source.indexOf(`function ${name}(`);
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

test("composer @ intent menu exposes Loop and removes task-card menu shortcuts", () => {
  const runtime = composerRuntime.createComposerRuntime({});
  const options = runtime.composerIntentOptions();
  assert.deepEqual(options.map((option) => option.kind), ["goal", "chatgpt-pro", "loop"]);
  assert.ok(options.some((option) => option.kind === "loop" && option.tag === "@loop" && option.label === "Loop"));
  assert.equal(options.some((option) => option.kind === "task-card"), false);
  assert.equal(options.some((option) => option.kind === "task-card-auto"), false);

  const optionsBody = functionBody(composerRuntimeJs, "composerIntentOptions");
  assert.doesNotMatch(optionsBody, /@任务卡片|@自由协作|kind:\s*"task-card"/);
});

test("composer recognizes @loop intent without turning task-card tags into dialog entries", () => {
  const runtime = composerRuntime.createComposerRuntime({
    THREAD_GOAL_MENTION_PATTERN: /^@(目标任务|目标|Goal)$/i,
    THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN: /^@(自由协作)(?:\s|$)/i,
    THREAD_TASK_CARD_MENTION_PATTERN: /^@(任务卡片)(?:\s|$)/i,
    threadTaskCardCommandText: () => "",
  });
  assert.equal(runtime.composerIntentBareTagKind("@loop"), "loop");
  assert.equal(runtime.composerIntentBareTagKind("@Loop"), "loop");
  assert.equal(runtime.composerIntentBareTagKind("@任务卡片"), "");
  assert.equal(runtime.composerIntentBareTagKind("@自由协作"), "");
});

test("composer intent menu activates dialogs directly on Android-safe pointer events", () => {
  const wireUiBody = functionBody(appShellRuntimeJs, "wireUi");
  assert.match(wireUiBody, /const handleComposerIntentOption = \(event\) => \{/);
  assert.match(wireUiBody, /intentMenu\.addEventListener\("pointerdown", handleComposerIntentOption\)/);
  assert.match(wireUiBody, /intentMenu\.addEventListener\("touchend", handleComposerIntentOption, \{ passive: false \}\)/);
  assert.match(wireUiBody, /intentMenu\.addEventListener\("click", handleComposerIntentOption\)/);
  assert.match(wireUiBody, /suppressSyntheticComposerIntentOptionUntil = now \+ 2200/);
  assert.match(wireUiBody, /selectComposerIntent\(option\.dataset\.composerIntent \|\| "", \{ openDialog: true, source: eventType \}\)/);

  const selectBody = functionBody(composerRuntimeJs, "selectComposerIntent");
  assert.match(selectBody, /options\.openDialog === true/);
  assert.match(selectBody, /openSelectedComposerIntentDialog\(kind, options\)/);

  const selectedDialogBody = functionBody(composerRuntimeJs, "openSelectedComposerIntentDialog");
  assert.match(selectedDialogBody, /kind === "goal"/);
  assert.match(selectedDialogBody, /setComposerText\(""\)/);
  assert.match(selectedDialogBody, /openThreadGoalDialog\(targetThreadId\)/);
  assert.match(selectedDialogBody, /return openComposerIntentDialog\(kind, options\)/);
});

test("composer renders source-requirements waiting state for @loop", () => {
  const runtime = composerRuntime.createComposerRuntime({});
  const outcome = runtime.atLoopRequestClientOutcome({
    ok: true,
    loop: {
      loopId: "loop_1234567890abcdef",
      status: "waiting_source_requirements",
      nextRoute: "source_requirements_pending",
      sourceRequirementsStatus: {
        pending: true,
        missingSections: ["requirements_packet", "design_contract_packet"],
      },
    },
  });

  assert.equal(outcome.waitingSourceRequirements, true);
  assert.equal(outcome.loopStatus, "waiting_source_requirements");
  assert.equal(outcome.nextRoute, "source_requirements_pending");
  assert.deepEqual(outcome.missingSections, ["requirements_packet", "design_contract_packet"]);
  assert.match(outcome.statusText, /Loop 等待主线程需求分析/);
  assert.match(outcome.statusText, /需求包/);
  assert.match(outcome.statusText, /设计契约包/);
  assert.equal(outcome.activityText, "Loop 等待需求分析");
});

test("composer submits @loop through at-loop API before normal message paths", () => {
  assert.match(composerRuntimeJs, /function isAtLoopCommandText\(/);
  assert.match(composerRuntimeJs, /function atLoopCommandObjectiveText\(/);
  assert.match(composerRuntimeJs, /function atLoopRequestClientOutcome\(/);
  assert.match(composerRuntimeJs, /async function submitAtLoopRequest\(/);
  assert.match(functionBody(composerRuntimeJs, "submitAtLoopRequest"), /api\("\/api\/at-loop\/triggers"/);
  assert.match(functionBody(composerRuntimeJs, "submitAtLoopRequest"), /atLoopRequestClientOutcome\(result\)/);
  assert.match(functionBody(composerRuntimeJs, "submitAtLoopRequest"), /waitingSourceRequirements/);
  assert.match(functionBody(composerRuntimeJs, "submitComposerIntentDialog"), /kind === "loop"[\s\S]*submitAtLoopRequest\(`\$\{option\.tag\} \$\{body\}`, \{ rethrow: true \}\)/);
  assert.match(functionBody(composerRuntimeJs, "submitComposerIntentDialog"), /waitingSourceRequirements[\s\S]*setComposerIntentDialogStatus\(intentResult\.statusText\)[\s\S]*return;/);

  const sendBody = functionBody(composerRuntimeJs, "sendMessage");
  const loopIndex = sendBody.indexOf("isAtLoopCommandText(text)");
  assert.ok(loopIndex >= 0, "sendMessage should inspect @loop command text");
  assert.ok(loopIndex < sendBody.indexOf("sendNewThreadMessage(text"), "@loop should intercept before new-thread send");
  assert.ok(loopIndex < sendBody.indexOf("isThreadTaskCardCommandText(text)"), "@loop should intercept before task-card command send");
  assert.ok(loopIndex < sendBody.indexOf("/api/threads/${encodeURIComponent(targetThreadId)}/messages"), "@loop should intercept before normal message send");
});

test("composer bridge keeps a legacy submitAtLoopRequest wrapper", () => {
  assert.match(composerRuntimeJs, /submitAtLoopRequest,/);
  assert.match(composerBridgeRuntimeJs, /async function submitAtLoopRequest\(\.\.\.args\) \{\s*return composerRuntime\.submitAtLoopRequest\(\.\.\.args\);/);
  assert.match(functionBody(composerBridgeRuntimeJs, "createComposerBridgeRuntime"), /submitAtLoopRequest: typeof submitAtLoopRequest === "function" \? submitAtLoopRequest : null/);
});
