"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  DEFAULT_HOME_AI_DEPLOY_LANE_TITLES,
  HOME_AI_DEPLOY_LANE_TITLE,
  deployLaneTitleForPlugin,
  findHomeAiDeployLaneThread,
  hasExplicitThreadTarget,
  isRoutinePluginDeploymentRequest,
  normalizeHomeAiDeployLaneSummary,
  planHomeAiDeployLaneRouting,
  prioritizeDelegationTargetHints,
} = require("../services/task-cards/thread-task-card-deploy-lane-policy-service");

const canonicalDeployLanePolicyService = require("../services/task-cards/thread-task-card-deploy-lane-policy-service");
const adapterDeployLanePolicyService = require("../adapters/thread-task-card-deploy-lane-policy-service");

const homeAiCwd = "/Users/hermes-dev/HermesMobileDev/app";
const pluginCwd = "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web";

function thread(id, name, cwd, extra = {}) {
  return Object.assign({ id, name, cwd, updatedAt: 1, status: "completed" }, extra);
}

test("task-card deploy-lane policy adapter re-exports the canonical service boundary", () => {
  assert.equal(adapterDeployLanePolicyService.planHomeAiDeployLaneRouting, canonicalDeployLanePolicyService.planHomeAiDeployLaneRouting);
  assert.equal(adapterDeployLanePolicyService.prioritizeDelegationTargetHints, canonicalDeployLanePolicyService.prioritizeDelegationTargetHints);
});

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

test("delegation target hints prioritize configured deploy lane pool in stable title order", () => {
  const laneC = thread("deploy-c", "Home AI Deploy Lane C", homeAiCwd, { updatedAt: 400 });
  const movie = thread("deploy-movie", "Movie Deploy Lane", homeAiCwd, { updatedAt: 100 });
  const codex = thread("deploy-codex", "Codex Mobile Deploy Lane", homeAiCwd, { updatedAt: 200 });
  const ordinary = thread("home-1", "Home AI 06-22", homeAiCwd, { updatedAt: 1000 });
  const deploy = thread("deploy-1", HOME_AI_DEPLOY_LANE_TITLE, homeAiCwd, { updatedAt: 1 });

  const ordered = prioritizeDelegationTargetHints([ordinary, laneC, movie, codex, deploy]);

  assert.deepEqual(ordered.slice(0, 5).map((item) => item.name), [
    HOME_AI_DEPLOY_LANE_TITLE,
    "Home AI Deploy Lane C",
    "Codex Mobile Deploy Lane",
    "Movie Deploy Lane",
    "Home AI 06-22",
  ]);
  assert.deepEqual(DEFAULT_HOME_AI_DEPLOY_LANE_TITLES.slice(0, 2), [HOME_AI_DEPLOY_LANE_TITLE, "Home AI Deploy Lane A"]);
});

test("routine plugin deploy card targeting ordinary Home AI is retargeted to assigned deploy lane", () => {
  const ordinaryHomeAi = thread("home-1", "Home AI 06-22", homeAiCwd, { updatedAt: 100 });
  const deployLane = normalizeHomeAiDeployLaneSummary(thread("deploy-codex", "Codex Mobile Deploy Lane", homeAiCwd, {
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
  assert.deepEqual(plan.targetThreadIds, ["deploy-codex"]);
});

test("plugin_deployment card for codex-mobile-web resolves to Codex Mobile Deploy Lane when live", () => {
  const ordinaryHomeAi = thread("home-1", "Home AI 06-22", homeAiCwd, { updatedAt: 100 });
  const codexDeployLane = normalizeHomeAiDeployLaneSummary(thread("deploy-codex", "Codex Mobile Deploy Lane", homeAiCwd, {
    updatedAt: 20,
  }));

  const plan = planHomeAiDeployLaneRouting({
    body: {
      cardKind: "plugin_deployment",
      pluginId: "codex-mobile-web",
      title: "Deploy Codex Mobile plugin",
      body: "Routine production deploy and readback.",
    },
    sourceThread: thread("source-1", "codex mobile", pluginCwd),
    targetThreads: [ordinaryHomeAi],
    visibleThreads: [ordinaryHomeAi, codexDeployLane],
  });

  assert.equal(plan.action, "retarget");
  assert.equal(plan.pluginId, "codex-mobile-web");
  assert.equal(plan.expectedDeployLaneTitle, "Codex Mobile Deploy Lane");
  assert.deepEqual(plan.targetThreadIds, ["deploy-codex"]);
});

test("plugin_deployment card for movie resolves to Movie Deploy Lane when live", () => {
  const ordinaryHomeAi = thread("home-1", "Home AI 06-22", homeAiCwd, { updatedAt: 100 });
  const movieDeployLane = normalizeHomeAiDeployLaneSummary(thread("deploy-movie", "Movie Deploy Lane", homeAiCwd, {
    updatedAt: 20,
  }));

  const plan = planHomeAiDeployLaneRouting({
    body: {
      cardKind: "plugin_deployment",
      pluginId: "movie",
      title: "Deploy Movie plugin",
      body: "Routine production deploy and readback.",
    },
    sourceThread: thread("source-1", "Movie", "/Users/hermes-dev/HermesMobileDev/Movie"),
    targetThreads: [ordinaryHomeAi],
    visibleThreads: [ordinaryHomeAi, movieDeployLane],
  });

  assert.equal(plan.action, "retarget");
  assert.equal(plan.pluginId, "movie");
  assert.equal(plan.expectedDeployLaneTitle, "Movie Deploy Lane");
  assert.deepEqual(plan.targetThreadIds, ["deploy-movie"]);
});

test("Movie routine deployment from top-level workspace retargets Home AI Deploy to Movie Deploy Lane", () => {
  const homeAiDeploy = normalizeHomeAiDeployLaneSummary(thread("deploy-home", "Home AI Deploy", homeAiCwd, {
    updatedAt: 200,
  }));
  const movieDeployLane = normalizeHomeAiDeployLaneSummary(thread("deploy-movie", "Movie Deploy Lane", homeAiCwd, {
    updatedAt: 20,
  }));

  const plan = planHomeAiDeployLaneRouting({
    body: {
      title: "Deploy Movie v162 source route",
      summary: "Deploy Movie v162 and run bounded production readback.",
    },
    sourceThread: thread("source-movie", "Movie", "/Users/hermes-dev/HermesMobileDev/Movie"),
    targetThreads: [homeAiDeploy],
    visibleThreads: [homeAiDeploy, movieDeployLane],
  });

  assert.equal(plan.action, "retarget");
  assert.equal(plan.pluginId, "movie");
  assert.deepEqual(plan.targetThreadIds, ["deploy-movie"]);
});

test("Movie routine deployment retargets wrong Codex Mobile same-cwd thread to Movie Deploy Lane", () => {
  const wrongCodexThread = thread("codex-pr", "Codex Mobile Public PR", pluginCwd, {
    status: "completed",
    updatedAt: 500,
  });
  const movieDeployLane = normalizeHomeAiDeployLaneSummary(thread("deploy-movie", "Movie Deploy Lane", homeAiCwd, {
    updatedAt: 20,
  }));

  const plan = planHomeAiDeployLaneRouting({
    body: {
      title: "Deploy Movie v162 source route",
      summary: "Deploy Movie v162 and run bounded production readback.",
    },
    sourceThread: thread("source-movie", "Movie", "/Users/hermes-dev/HermesMobileDev/Movie"),
    targetThreads: [wrongCodexThread],
    visibleThreads: [wrongCodexThread, movieDeployLane],
  });

  assert.equal(plan.action, "retarget");
  assert.equal(plan.expectedDeployLaneTitle, "Movie Deploy Lane");
  assert.deepEqual(plan.targetThreadIds, ["deploy-movie"]);
});

test("Movie deploy-routing repair card is not treated as a routine plugin deployment", () => {
  const wrongCodexThread = thread("codex-pr", "Codex Mobile Public PR", pluginCwd, {
    status: "completed",
    updatedAt: 500,
  });
  const movieDeployLane = normalizeHomeAiDeployLaneSummary(thread("deploy-movie", "Movie Deploy Lane", homeAiCwd, {
    updatedAt: 20,
  }));

  const plan = planHomeAiDeployLaneRouting({
    body: {
      title: "Fix Movie deploy thread routing visibility",
      summary: "Investigate Codex Mobile target discovery: missing Movie deploy thread and archived hint caused wrong target.",
    },
    sourceThread: thread("source-movie", "Movie", "/Users/hermes-dev/HermesMobileDev/Movie"),
    targetThreads: [wrongCodexThread],
    visibleThreads: [wrongCodexThread, movieDeployLane],
  });

  assert.equal(plan.action, "allow");
  assert.equal(plan.reason, "not_routine_plugin_deployment");
});

test("explicit Music permission repair target is not overridden by deploy lane text", () => {
  const codexImplementation = thread("codex-impl", "codex mobile 06-30", pluginCwd, {
    status: { type: "active" },
    updatedAt: 500,
  });
  const codexDeployLane = normalizeHomeAiDeployLaneSummary(thread("deploy-codex", "Codex Mobile Deploy Lane", homeAiCwd, {
    updatedAt: 20,
  }));
  const body = {
    targetThreadId: "codex-impl",
    title: "Repair workspace read permission for Music continuation",
    summary: "Fix Codex Mobile Web managed permission profile so Music continuations can read existing source files.",
    body: [
      "Correct routing target: codex mobile 06-30 / codex-impl.",
      "This is not the deploy lane.",
      "Music saw Operation not permitted while reading source and needs the implementation thread to repair workspace read permission.",
    ].join("\n"),
  };

  const plan = planHomeAiDeployLaneRouting({
    body,
    sourceThread: thread("music-source", "Music 06-23", "/Users/xuxin/Documents/Music"),
    targetThreads: [codexImplementation],
    visibleThreads: [codexImplementation, codexDeployLane],
  });

  assert.equal(hasExplicitThreadTarget(body), true);
  assert.equal(isRoutinePluginDeploymentRequest(body, thread("music-source", "Music 06-23", "/Users/xuxin/Documents/Music")), false);
  assert.equal(plan.action, "allow");
  assert.equal(plan.reason, "explicit_non_deploy_target");
});

test("structured plugin_deployment still overrides ordinary explicit targets", () => {
  const codexImplementation = thread("codex-impl", "codex mobile 06-30", pluginCwd, {
    status: { type: "active" },
    updatedAt: 500,
  });
  const codexDeployLane = normalizeHomeAiDeployLaneSummary(thread("deploy-codex", "Codex Mobile Deploy Lane", homeAiCwd, {
    updatedAt: 20,
  }));

  const plan = planHomeAiDeployLaneRouting({
    body: {
      cardKind: "plugin_deployment",
      pluginId: "codex-mobile-web",
      targetThreadId: "codex-impl",
      title: "Deploy Codex Mobile plugin",
      body: "Routine plugin deployment and bounded readback.",
    },
    sourceThread: thread("source-1", "codex mobile", pluginCwd),
    targetThreads: [codexImplementation],
    visibleThreads: [codexImplementation, codexDeployLane],
  });

  assert.equal(plan.action, "retarget");
  assert.equal(plan.reason, "routine_plugin_deployment_uses_deploy_lane");
  assert.deepEqual(plan.targetThreadIds, ["deploy-codex"]);
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
  assert.equal(plan.expectedDeployLaneTitle, "Codex Mobile Deploy Lane");
});

test("routine plugin deploy card fails closed when configured deploy lane title is ambiguous", () => {
  const ordinaryHomeAi = thread("home-1", "Home AI 06-22", homeAiCwd);
  const deployA = thread("deploy-a", "Codex Mobile Deploy Lane", homeAiCwd);
  const deployB = thread("deploy-b", "Codex Mobile Deploy Lane", homeAiCwd);

  const plan = planHomeAiDeployLaneRouting({
    body: {
      cardKind: "plugin_deployment",
      pluginId: "codex-mobile-web",
      title: "Deploy Codex Mobile plugin",
    },
    sourceThread: thread("source-1", "codex mobile", pluginCwd),
    targetThreads: [ordinaryHomeAi],
    visibleThreads: [ordinaryHomeAi, deployA, deployB],
  });

  assert.equal(plan.action, "reject");
  assert.equal(plan.code, "deploy_lane_ambiguous");
  assert.deepEqual(plan.duplicateTitles, ["codex mobile deploy lane"]);
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

test("deploy lane title assignment pins known plugin ids and hashes unknown plugin ids", () => {
  assert.equal(deployLaneTitleForPlugin("codex-mobile-web"), "Codex Mobile Deploy Lane");
  assert.equal(deployLaneTitleForPlugin("movie"), "Movie Deploy Lane");
  assert.ok(DEFAULT_HOME_AI_DEPLOY_LANE_TITLES.includes(deployLaneTitleForPlugin("unknown-plugin")));
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
