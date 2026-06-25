"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  continuationGoalMigrationPlan,
  createThreadGoalService,
  normalizeThreadGoalStatus,
  publicThreadGoal,
} = require("../adapters/thread-goal-service");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");

function functionBody(source, name) {
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

test("thread goal service normalizes sqlite rows for public thread state", () => {
  assert.equal(normalizeThreadGoalStatus("budget_limited"), "budgetLimited");
  assert.equal(normalizeThreadGoalStatus("usage_limited"), "usageLimited");
  assert.equal(normalizeThreadGoalStatus("blocked"), "blocked");
  assert.equal(normalizeThreadGoalStatus("completed"), "complete");

  const goal = publicThreadGoal({
    thread_id: "thread-1",
    goal_id: "private-id",
    objective: `  ${"x".repeat(4100)}  `,
    status: "budget_limited",
    token_budget: 1000,
    tokens_used: 25,
    time_used_seconds: 8,
    created_at_ms: 10,
    updated_at_ms: 20,
  });

  assert.equal(goal.threadId, "thread-1");
  assert.equal(goal.status, "budgetLimited");
  assert.equal(goal.tokenBudget, 1000);
  assert.equal(goal.tokensUsed, 25);
  assert.equal(goal.timeUsedSeconds, 8);
  assert.equal(goal.createdAt, 10);
  assert.equal(goal.updatedAt, 20);
  assert.equal(Object.hasOwn(goal, "goalId"), false);
  assert.equal(goal.objective.length, 4000);
  assert.ok(goal.objective.endsWith("..."));
});

test("thread goal service attaches goals to list results without requiring writes", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-thread-goals-"));
  const dbPath = path.join(tempDir, "goals_1.sqlite");
  fs.writeFileSync(dbPath, "");
  const queries = [];
  const service = createThreadGoalService({
    dbPath,
    sqlite: {
      json(receivedDbPath, sql) {
        queries.push({ receivedDbPath, sql });
        return {
          ok: true,
          rows: [{
            thread_id: "thread-2",
            objective: "Ship goal support",
            status: "active",
            token_budget: null,
            tokens_used: 12,
            time_used_seconds: 3,
            created_at_ms: 100,
            updated_at_ms: 200,
          }],
        };
      },
    },
  });

  const result = service.attachGoalsToThreadListResult({
    data: [{ id: "thread-1" }, { id: "thread-2" }],
  });

  assert.equal(queries.length, 1);
  assert.equal(queries[0].receivedDbPath, dbPath);
  assert.match(queries[0].sql, /FROM thread_goals/);
  assert.match(queries[0].sql, /thread-1/);
  assert.match(queries[0].sql, /thread-2/);
  assert.equal(result.data[0].goal, undefined);
  assert.equal(result.data[1].goal.objective, "Ship goal support");
});

test("thread goal service plans continuation goal migration without carrying spent budget", () => {
  const activePlan = continuationGoalMigrationPlan({
    threadId: "source-thread",
    objective: "Continue the long task",
    status: "active",
    tokenBudget: 1000,
    tokensUsed: 250,
  });

  assert.equal(activePlan.migrate, true);
  assert.equal(activePlan.sourceStatus, "active");
  assert.equal(activePlan.targetStatus, "active");
  assert.equal(activePlan.tokenBudget, 750);
  assert.equal(activePlan.sourceTokenBudget, 1000);
  assert.equal(activePlan.sourceTokensUsed, 250);

  const blockedPlan = continuationGoalMigrationPlan({
    thread_id: "source-thread",
    objective: "Blocked task",
    status: "blocked",
    token_budget: 100,
    tokens_used: 150,
  });

  assert.equal(blockedPlan.migrate, true);
  assert.equal(blockedPlan.targetStatus, "blocked");
  assert.equal(blockedPlan.tokenBudget, null);

  const completePlan = continuationGoalMigrationPlan({
    threadId: "source-thread",
    objective: "Done",
    status: "complete",
  });

  assert.equal(completePlan.migrate, false);
  assert.equal(completePlan.reason, "completed");
});

test("thread goal service degrades to empty results when the goals db is absent", () => {
  let called = false;
  const service = createThreadGoalService({
    dbPath: path.join(os.tmpdir(), `missing-goals-${Date.now()}.sqlite`),
    sqlite: {
      json() {
        called = true;
        return { ok: true, rows: [] };
      },
    },
  });

  assert.equal(service.goalForThread("thread-1"), null);
  assert.equal(called, false);
});

test("server enriches thread list and detail responses with thread goals", () => {
  assert.match(serverJs, /createThreadGoalService/);
  assert.match(serverJs, /normalizeThreadGoalStatus/);
  assert.match(serverJs, /const GOALS_DB = path\.join\(CODEX_HOME, "goals_1\.sqlite"\)/);
  assert.match(serverJs, /const threadGoalService = createThreadGoalService/);
  assert.match(serverJs, /const THREAD_GOAL_OBJECTIVE_MAX_CHARS = 4000/);
  assert.match(serverJs, /async function setThreadGoal\(/);
  assert.match(functionBody(serverJs, "normalizeThreadGoalObjectiveInput"), /THREAD_GOAL_OBJECTIVE_MAX_CHARS/);
  assert.match(serverJs, /codex\.request\("thread\/goal\/set"/);
  assert.match(serverJs, /codex\.request\("thread\/goal\/clear"/);
  assert.match(serverJs, /codex\.request\("thread\/goal\/get"/);
  assert.match(serverJs, /async function runThreadGoalAction\(/);
  assert.match(functionBody(serverJs, "runThreadGoalAction"), /action === "pause"/);
  assert.match(functionBody(serverJs, "runThreadGoalAction"), /status: "blocked"/);
  assert.match(functionBody(serverJs, "runThreadGoalAction"), /action === "continue"/);
  assert.match(functionBody(serverJs, "runThreadGoalAction"), /await clearThreadGoalForSet\(id\)/);
  assert.match(serverJs, /function isCompletedThreadGoal\(/);
  assert.match(functionBody(serverJs, "isCompletedThreadGoal"), /normalizeThreadGoalStatus\(goal\.status\) === "complete"/);
  assert.match(serverJs, /function currentThreadGoalForSet\(/);
  assert.match(functionBody(serverJs, "currentThreadGoalForSet"), /threadGoalService\.goalForThread\(threadId\)/);
  assert.match(functionBody(serverJs, "setThreadGoal"), /isCompletedThreadGoal\(currentThreadGoalForSet\(id\)\)/);
  assert.match(functionBody(serverJs, "setThreadGoal"), /await clearThreadGoalForSet\(id\)/);
  assert.match(functionBody(serverJs, "setThreadGoal"), /setThreadGoalRpc\(params\)/);
  assert.match(functionBody(serverJs, "setThreadGoal"), /isCompletedThreadGoal\(goal\)/);
  assert.match(functionBody(serverJs, "setThreadGoal"), /clearedCompletedGoal/);
  assert.match(serverJs, /continuationGoalMigrationPlan/);
  assert.match(serverJs, /async function migrateContinuationThreadGoal\(/);
  assert.match(functionBody(serverJs, "migrateContinuationThreadGoal"), /currentThreadGoalForAction\(sourceId\)/);
  assert.match(functionBody(serverJs, "migrateContinuationThreadGoal"), /setThreadGoalRpc\(threadGoalSetParams\(targetId, plan\.objective, plan\.tokenBudget, targetExtra\)\)/);
  assert.match(functionBody(serverJs, "migrateContinuationThreadGoal"), /plan\.sourceStatus === "active"/);
  assert.match(functionBody(serverJs, "migrateContinuationThreadGoal"), /status: "blocked"/);
  assert.ok(serverJs.includes("url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/goal$/)"));
  assert.ok(serverJs.includes("url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/goal\\/actions$/)"));
  assert.match(serverJs, /function attachThreadGoalToThread\(/);
  assert.match(serverJs, /threadGoalService\.attachGoalToThread\(thread\)/);
  assert.match(serverJs, /function attachThreadGoalsToThreadListResult\(/);
  assert.match(serverJs, /threadGoalService\.attachGoalsToThreadListResult\(result\)/);
  assert.match(serverJs, /function attachThreadListStateToResult\(/);
  assert.match(serverJs, /attachThreadTaskCardCountsToThreadListResult\(attachThreadGoalsToThreadListResult\(result\)\)/);
  assert.match(serverJs, /attachThreadListStateToResult\(result\)/);
  assert.match(serverJs, /attachThreadGoalToThread\(result\.thread\)/);
});

test("mobile client renders and updates thread goals from app-server notifications", () => {
  assert.match(appJs, /CLIENT_BUILD_ID = "0\.1\.11\|codex-mobile-shell-v430"/);
  assert.match(appJs, /function normalizeThreadGoal\(/);
  assert.match(appJs, /function submittedThreadGoal\(/);
  assert.match(appJs, /function renderThreadGoal\(/);
  assert.match(appJs, /thread-card-goal-badge/);
  assert.match(appJs, /thread\/goal\/updated/);
  assert.match(appJs, /thread\/goal\/cleared/);
  assert.match(functionBody(appJs, "conversationRenderSignature"), /goal: threadGoalSignature\(thread\)/);
  assert.match(functionBody(appJs, "renderThreads"), /const goal = threadGoalForThread\(thread\)/);
  assert.match(functionBody(appJs, "renderThreads"), /threadGoalSignature\(thread\)/);
  assert.match(functionBody(appJs, "renderCurrentThread"), /const goalCard = renderThreadGoal\(thread, previousKeys\)/);
  assert.match(appJs, /function dialogPrefillThreadGoal\(/);
  assert.match(functionBody(appJs, "threadGoalBudgetText"), /budget tokens/);
  assert.match(functionBody(appJs, "dialogPrefillThreadGoal"), /normalizedGoal\.status === "complete" \? null : normalizedGoal/);
  assert.match(functionBody(appJs, "openThreadGoalDialog"), /const goal = dialogPrefillThreadGoal\(threadGoalForThread\(thread\)\)/);
  assert.match(functionBody(appJs, "updateThreadGoalState"), /delete thread\.goal/);
  assert.match(functionBody(appJs, "updateThreadGoalState"), /delete state\.currentThread\.goal/);
  assert.match(functionBody(appJs, "applyNotification"), /method === "thread\/goal\/updated"[\s\S]*updateThreadGoalState\(params\.threadId, params\.goal\)/);
  assert.match(functionBody(appJs, "applyNotification"), /method === "thread\/goal\/cleared"[\s\S]*updateThreadGoalState\(params\.threadId, null\)/);
  assert.match(stylesCss, /\.thread-goal-card/);
  assert.match(stylesCss, /\.thread-card-goal-badge/);
});

test("mobile client opens goal dialog from /g and sets goal through app-server route", () => {
  assert.match(indexHtml, /id="goalDialog"/);
  assert.match(indexHtml, /id="goalForm"/);
  assert.match(indexHtml, /id="goalObjectiveInput"/);
  assert.match(indexHtml, /id="goalObjectiveInput"[\s\S]*maxlength="4000"/);
  assert.match(indexHtml, /id="goalTokenBudgetInput"/);
  assert.match(indexHtml, /id="goalDialogStatus"/);
  assert.match(indexHtml, /id="goalContinueButton"/);
  assert.match(indexHtml, /id="goalPauseButton"/);
  assert.match(indexHtml, /id="goalClearButton"/);
  assert.match(appJs, /const THREAD_GOAL_COMMAND_PREFIX = "\/g"/);
  assert.match(appJs, /function isThreadGoalCommandText\(/);
  assert.match(appJs, /function openThreadGoalDialog\(/);
  assert.doesNotMatch(appJs, /function buildThreadGoalRequestMessage\(/);
  assert.doesNotMatch(appJs, /Please set the current goal for this Codex thread/);
  assert.doesNotMatch(appJs, /Use the CLI goal feature if it is available/);
  assert.match(functionBody(appJs, "updateComposerControls"), /isThreadGoalCommandText\(composerText\(\)\)/);
  assert.match(functionBody(appJs, "updateComposerControls"), /setComposerActionButtonLabel\(sendButton, "Goal"\)/);
  assert.match(functionBody(appJs, "sendMessage"), /const threadGoalCommand = isThreadGoalCommandText\(text\)/);
  assert.match(functionBody(appJs, "sendMessage"), /openThreadGoalDialog\(targetThreadId\)/);
  assert.match(functionBody(appJs, "sendMessage"), /setComposerText\(""\)/);
  assert.match(functionBody(appJs, "submitThreadGoalMessage"), /api\(`\/api\/threads\/\$\{encodeURIComponent\(threadId\)\}\/goal`/);
  assert.match(functionBody(appJs, "submitThreadGoalMessage"), /JSON\.stringify\(\{/);
  assert.match(functionBody(appJs, "submitThreadGoalMessage"), /const responseGoal = normalizeThreadGoal\(result && result\.goal, threadId\)/);
  assert.match(functionBody(appJs, "submitThreadGoalMessage"), /const visibleGoal = responseGoal \|\| submittedThreadGoal\(threadId, objective, tokenBudget\)/);
  assert.match(functionBody(appJs, "submitThreadGoalMessage"), /if \(visibleGoal\) updateThreadGoalState\(threadId, visibleGoal\)/);
  assert.match(appJs, /function runThreadGoalDialogAction\(/);
  assert.match(functionBody(appJs, "runThreadGoalDialogAction"), /\/api\/threads\/\$\{encodeURIComponent\(threadId\)\}\/goal\/actions/);
  assert.match(functionBody(appJs, "runThreadGoalDialogAction"), /action: normalizedAction/);
  assert.match(functionBody(appJs, "runThreadGoalDialogAction"), /normalizedAction === "cancel"[\s\S]*updateThreadGoalState\(threadId, null\)/);
  assert.match(functionBody(appJs, "updateThreadGoalDialogState"), /goalStateActions/);
  assert.match(functionBody(appJs, "updateThreadGoalDialogState"), /normalizedGoal \? "Save" : "Send"/);
  assert.match(appJs, /function requestGoalDialogSubmitFromEnter\(/);
  assert.match(functionBody(appJs, "requestGoalDialogSubmitFromEnter"), /event\.key !== "Enter"/);
  assert.match(functionBody(appJs, "requestGoalDialogSubmitFromEnter"), /event\.shiftKey/);
  assert.match(functionBody(appJs, "requestGoalDialogSubmitFromEnter"), /event\.isComposing/);
  assert.match(functionBody(appJs, "requestGoalDialogSubmitFromEnter"), /requestGoalDialogSubmit\(\)/);
  assert.match(appJs, /function requestGoalDialogSubmitFromButton\(/);
  assert.match(functionBody(appJs, "requestGoalDialogSubmitFromButton"), /event\.preventDefault\(\)/);
  assert.match(functionBody(appJs, "requestGoalDialogSubmitFromButton"), /state\.lastGoalButtonSubmitAt/);
  assert.match(functionBody(appJs, "requestGoalDialogSubmitFromButton"), /postClientEvent\("goal_button_pressed"/);
  assert.match(functionBody(appJs, "requestGoalDialogSubmitFromButton"), /requestGoalDialogSubmit\(\)/);
  assert.match(appJs, /function requestGoalDialogSubmit\(/);
  assert.match(functionBody(appJs, "requestGoalDialogSubmit"), /form\.requestSubmit\(\)/);
  assert.match(appJs, /goalObjectiveInput"\)\.addEventListener\("keydown", requestGoalDialogSubmitFromEnter\)/);
  assert.match(appJs, /goalTokenBudgetInput"\)\.addEventListener\("keydown", requestGoalDialogSubmitFromEnter\)/);
  assert.match(appJs, /goalSubmitButton"\)\.addEventListener\("pointerdown", requestGoalDialogSubmitFromButton\)/);
  assert.match(appJs, /goalSubmitButton"\)\.addEventListener\("pointerup", requestGoalDialogSubmitFromButton\)/);
  assert.match(appJs, /goalSubmitButton"\)\.addEventListener\("touchend", requestGoalDialogSubmitFromButton, \{ passive: false \}\)/);
  assert.match(appJs, /goalSubmitButton"\)\.addEventListener\("click", requestGoalDialogSubmitFromButton\)/);
  assert.match(appJs, /goalContinueButton"\)\.addEventListener\("click", \(event\) => runThreadGoalDialogAction\("continue", event\)/);
  assert.match(appJs, /goalPauseButton"\)\.addEventListener\("click", \(event\) => runThreadGoalDialogAction\("pause", event\)/);
  assert.match(appJs, /goalClearButton"\)\.addEventListener\("click", \(event\) => runThreadGoalDialogAction\("cancel", event\)/);
  assert.match(functionBody(appJs, "submitThreadGoalMessage"), /postClientEvent\("goal_request_start"/);
  assert.match(functionBody(appJs, "submitThreadGoalMessage"), /postClientEvent\("goal_request_success"/);
  assert.doesNotMatch(functionBody(appJs, "submitThreadGoalMessage"), /\/messages`/);
  assert.doesNotMatch(functionBody(appJs, "submitThreadGoalMessage"), /body\.append\("model"/);
  assert.doesNotMatch(functionBody(appJs, "submitThreadGoalMessage"), /selectedComposerEffort\(\)/);
  assert.doesNotMatch(appJs, /goals_1\.sqlite/);
  assert.doesNotMatch(appJs, /data-open-thread-goal-dialog/);
  assert.match(stylesCss, /\.goal-dialog/);
  assert.match(stylesCss, /\.goal-panel/);
  assert.match(stylesCss, /\.goal-state-actions/);
  assert.match(stylesCss, /\.goal-action-danger/);
  assert.match(appJs, /const THREAD_GOAL_MENTION_PATTERN = \/\^@\(目标任务\|目标\|Goal\|Thread\\s\*Goal\|g\)\$/);
  assert.match(functionBody(appJs, "isThreadGoalCommandText"), /THREAD_GOAL_MENTION_PATTERN\.test\(text\)/);
  assert.match(appJs, /@目标任务/);
  assert.match(functionBody(appJs, "sendMessage"), /composerIntentBareTagKind\(text\)/);
});
