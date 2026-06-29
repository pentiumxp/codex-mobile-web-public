"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  HOME_AI_DEPLOY_LANE_TITLE,
  findHomeAiDeployLaneThread,
  isRoutinePluginDeploymentRequest,
  normalizeHomeAiDeployLaneSummary,
  planHomeAiDeployLaneRouting,
  prioritizeDelegationTargetHints,
} = require("../adapters/thread-task-card-deploy-lane-policy-service");

const homeAiCwd = "/Users/hermes-dev/HermesMobileDev/app";
const pluginCwd = "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web";

function thread(id, name, cwd, extra = {}) {
  return Object.assign({ id, name, cwd, updatedAt: 1, status: "completed" }, extra);
}

test("Home AI Deploy lane completed thread is normalized to durable idle lane metadata", () => {
  const raw = thread("deploy-1", HOME_AI_DEPLOY_LANE_TITLE, homeAiCwd, {
    status: { type: "completed" },
    activeTurnId: "turn-stale",
    mobileLocalActiveStatus: { turnId: "turn-stale" },
  });

  const normalized = normalizeHomeAiDeployLaneSummary(raw);

  assert.equal(normalized.id, "deploy-1");
  assert.equal(normalized.mobileDeployLane, true);
  assert.deepEqual(normalized.status, {
    type: "idle",
    mobileDeployLane: true,
    previousType: "completed",
  });
  assert.equal(normalized.activeTurnId, undefined);
  assert.equal(normalized.mobileLocalActiveStatus, undefined);
});

test("delegation target hints prioritize the Home AI Deploy lane over newer same-cwd Home AI threads", () => {
  const ordinary = thread("home-1", "Home AI 06-22", homeAiCwd, { updatedAt: 900 });
  const deploy = thread("deploy-1", HOME_AI_DEPLOY_LANE_TITLE, homeAiCwd, { updatedAt: 10 });
  const plugin = thread("plugin-1", "codex mobile", pluginCwd, { updatedAt: 1000 });

  const ordered = prioritizeDelegationTargetHints([ordinary, plugin, deploy]);

  assert.equal(ordered[0].id, "deploy-1");
  assert.equal(ordered[0].status.type, "idle");
  assert.deepEqual(ordered.map((item) => item.id), ["deploy-1", "plugin-1", "home-1"]);
});

test("routine plugin deploy card targeting ordinary Home AI is retargeted to Home AI Deploy lane", () => {
  const ordinaryHomeAi = thread("home-1", "Home AI 06-22", homeAiCwd, { updatedAt: 100 });
  const deployLane = normalizeHomeAiDeployLaneSummary(thread("deploy-1", HOME_AI_DEPLOY_LANE_TITLE, homeAiCwd, {
    updatedAt: 20,
  }));

  const plan = planHomeAiDeployLaneRouting({
    body: {
      title: "Deploy Codex Mobile plugin",
      body: "Run central deploy:macos with --plugin codex-mobile-web and production readback.",
    },
    sourceThread: thread("source-1", "codex mobile", pluginCwd),
    targetThreads: [ordinaryHomeAi],
    visibleThreads: [ordinaryHomeAi, deployLane],
  });

  assert.equal(plan.action, "retarget");
  assert.equal(plan.reason, "routine_plugin_deployment_uses_deploy_lane");
  assert.deepEqual(plan.targetThreadIds, ["deploy-1"]);
});

test("routine plugin deploy card fails closed when Home AI Deploy lane is absent", () => {
  const ordinaryHomeAi = thread("home-1", "Home AI 06-22", homeAiCwd);

  const plan = planHomeAiDeployLaneRouting({
    body: {
      title: "部署 Codex Mobile 插件",
      body: "插件生产部署和 readback。",
    },
    sourceThread: thread("source-1", "codex mobile", pluginCwd),
    targetThreads: [ordinaryHomeAi],
    visibleThreads: [ordinaryHomeAi],
  });

  assert.equal(plan.action, "reject");
  assert.equal(plan.code, "deploy_lane_required");
  assert.equal(plan.reason, "deploy_lane_missing");
});

test("Home AI host/platform repair cards still route to ordinary Home AI", () => {
  const ordinaryHomeAi = thread("home-1", "Home AI 06-22", homeAiCwd);

  const plan = planHomeAiDeployLaneRouting({
    body: {
      title: "Repair Home AI deploy-contract proxy timing",
      body: "Host-owned Home AI central deploy script and proxy/LaunchD repair. Do not run plugin deployment.",
    },
    sourceThread: thread("source-1", "codex mobile", pluginCwd),
    targetThreads: [ordinaryHomeAi],
    visibleThreads: [ordinaryHomeAi],
  });

  assert.equal(plan.action, "allow");
  assert.equal(plan.reason, "not_routine_plugin_deployment");
});

test("routine deployment classifier accepts structured card kind without task body scanning", () => {
  assert.equal(isRoutinePluginDeploymentRequest({
    cardKind: "plugin_deployment",
    title: "bounded title",
  }, thread("source-1", "codex mobile", pluginCwd)), true);
});

test("findHomeAiDeployLaneThread returns normalized deploy lane metadata", () => {
  const deploy = findHomeAiDeployLaneThread([
    thread("home-1", "Home AI 06-22", homeAiCwd),
    thread("deploy-1", HOME_AI_DEPLOY_LANE_TITLE, homeAiCwd, { status: "completed" }),
  ]);

  assert.equal(deploy.id, "deploy-1");
  assert.equal(deploy.status.type, "idle");
  assert.equal(deploy.mobileDeployLane, true);
});
