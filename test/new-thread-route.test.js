"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");

test("new-message route creates a thread before starting the first turn", () => {
  const routeIndex = serverJs.indexOf("/api/threads/new-message");
  const fallbackIndex = serverJs.indexOf('sendJson(res, 404, { error: "Not found" })');
  assert.ok(routeIndex > 0, "missing /api/threads/new-message route");
  assert.ok(routeIndex < fallbackIndex, "new-message route must run before 404 fallback");

  const routeBody = serverJs.slice(routeIndex, fallbackIndex);
  const threadStartIndex = routeBody.indexOf('codex.request("thread/start"');
  const turnStartIndex = routeBody.indexOf('codex.request("turn/start"');
  assert.ok(threadStartIndex > 0, "new-message route must call thread/start");
  assert.ok(turnStartIndex > threadStartIndex, "new-message route must start the first turn after thread/start");
});

test("new-message route forwards new-thread runtime settings", () => {
  const routeIndex = serverJs.indexOf("/api/threads/new-message");
  const fallbackIndex = serverJs.indexOf('sendJson(res, 404, { error: "Not found" })');
  const routeBody = serverJs.slice(routeIndex, fallbackIndex);

  assert.match(routeBody, /const requestedModel\s*=/, "new-thread route should read requested model");
  assert.match(routeBody, /const requestedEffort\s*=/, "new-thread route should read requested reasoning effort");
  assert.match(routeBody, /if \(requestedModel\) startParams\.model = requestedModel;/, "thread/start should receive requested model");
  assert.match(routeBody, /if \(requestedModel\) turnParams\.model = requestedModel;/, "turn/start should receive requested model");
  assert.match(routeBody, /if \(requestedEffort\) turnParams\.effort = requestedEffort;/, "turn/start should receive requested reasoning effort");
});

test("server default model falls back to GPT-5.5", () => {
  assert.match(serverJs, /const MODEL_OPTIONS = optionListFromEnv\("CODEX_MOBILE_MODEL_OPTIONS", \[\s*"gpt-5\.5"/);
  assert.match(serverJs, /const DEFAULT_MODEL = MODEL_OPTIONS\[0\] \|\| "gpt-5\.5";/);
  assert.match(serverJs, /defaultModel: CODEX_CONFIG_DEFAULTS\.model \|\| DEFAULT_MODEL/);
});

test("server maps quota groups to shared Codex and independent Spark models", () => {
  const start = serverJs.indexOf("function rateLimitModelKeys(");
  const end = serverJs.indexOf("function recordRateLimits(", start);
  assert.ok(start > 0 && end > start, "missing server quota mapping function");
  const body = serverJs.slice(start, end);

  assert.match(body, /limitId === "codex-bengalfox"[\s\S]*gpt-5\.3-codex-spark/, "Spark quota should map to Spark only");
  assert.match(body, /limitId === "codex"[\s\S]*!isSparkModelKey\(modelKey\)/, "Codex quota should map to non-Spark models");
});

test("server can hydrate quota snapshots from rollout token_count events", () => {
  assert.match(serverJs, /function loadRecentRateLimitsFromRollouts\(/, "server should scan local rollout evidence");
  assert.match(serverJs, /entry && entry\.payload && entry\.payload\.rate_limits/, "server should read native rollout rate_limits");
  assert.match(serverJs, /loadRecentRateLimitsFromRollouts\(\);[\s\S]*sendJson\(res, 200, \{[\s\S]*rateLimits: latestRateLimits/, "public config should include hydrated quota snapshots");
  assert.match(serverJs, /loadRecentRateLimitsFromRollouts\(\);[\s\S]*sendJson\(res, 200, codex\.status\(\)\)/, "status should include hydrated quota snapshots");
});

test("existing-message route forwards runtime settings on next turn", () => {
  const routeIndex = serverJs.indexOf('const messages = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/messages$/);');
  const fallbackIndex = serverJs.indexOf('const interrupt = url.pathname.match', routeIndex);
  assert.ok(routeIndex > 0, "missing existing message route");
  assert.ok(fallbackIndex > routeIndex, "missing message route end");
  const routeBody = serverJs.slice(routeIndex, fallbackIndex);

  assert.match(routeBody, /const requestedModel\s*=/, "message route should read requested model");
  assert.match(routeBody, /const requestedEffort\s*=/, "message route should read requested reasoning effort");
  assert.match(routeBody, /if \(requestedModel\) params\.model = requestedModel;/, "turn/start should receive requested model");
  assert.match(routeBody, /if \(requestedEffort\) params\.effort = requestedEffort;/, "turn/start should receive requested reasoning effort");
});

test("existing-message route falls back when active turn steering is stale", () => {
  const helperIndex = serverJs.indexOf("function isTurnSteerUnsupportedError(");
  const staleHelperIndex = serverJs.indexOf("function isStaleActiveTurnError(");
  const preflightIndex = serverJs.indexOf("async function staleActiveTurnPreflight(");
  assert.ok(helperIndex > 0, "missing turn/steer unsupported helper");
  assert.ok(staleHelperIndex > helperIndex, "missing stale active-turn helper");
  assert.ok(preflightIndex > staleHelperIndex, "missing stale active-turn preflight helper");

  const helperBody = serverJs.slice(helperIndex, serverJs.indexOf("function logClientEvent", helperIndex));
  assert.match(helperBody, /method not found\|unknown method/, "unsupported helper should only match method support errors");
  assert.doesNotMatch(helperBody, /method not found\|unknown method\|not found/, "generic not found must not be treated as unsupported turn/steer");
  assert.match(helperBody, /not found\|not active\|inactive\|completed\|interrupted/, "stale helper should catch stale active-turn errors");
  assert.match(helperBody, /detectStaleActiveTurnForSubmission/, "preflight should use service-owned stale-turn detection");
  assert.match(helperBody, /thread\/turns\/list/, "preflight should inspect latest durable turn state");
  assert.match(helperBody, /limit:\s*20/, "preflight should inspect enough recent turns to detect superseded active turns");

  const routeIndex = serverJs.indexOf('const messages = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/messages$/);');
  const fallbackIndex = serverJs.indexOf('const interrupt = url.pathname.match', routeIndex);
  const routeBody = serverJs.slice(routeIndex, fallbackIndex);
  const preflightCallIndex = routeBody.indexOf("staleActiveTurnPreflight(");
  const preflightLogIndex = routeBody.indexOf('logMessageSubmit("active-turn-stale-preflight"');
  const interruptIndex = routeBody.indexOf('codex.request("turn/interrupt"', preflightLogIndex);
  const steerIndex = routeBody.indexOf('codex.request("turn/steer"', interruptIndex);
  const staleLogIndex = routeBody.indexOf('logMessageSubmit("active-turn-stale"');
  const resumeIndex = routeBody.indexOf('codex.request("thread/resume"', staleLogIndex);
  const turnStartIndex = routeBody.indexOf('codex.request("turn/start"', resumeIndex);
  assert.ok(preflightCallIndex > 0, "message route should preflight stale active turns before steering");
  assert.ok(preflightLogIndex > preflightCallIndex, "message route should log stale active-turn preflight");
  assert.ok(interruptIndex > preflightLogIndex, "stale active turn should be interrupted before starting a new turn");
  assert.ok(steerIndex > interruptIndex, "normal turn/steer path should remain after preflight");
  assert.match(routeBody, /if \(body\.activeTurnId && !skipTurnSteer\)/, "stale preflight should skip turn/steer");
  assert.ok(staleLogIndex > 0, "message route should log stale active turn steering");
  assert.ok(resumeIndex > staleLogIndex, "stale active turn should fall through to thread/resume");
  assert.ok(turnStartIndex > resumeIndex, "stale active turn should fall through to turn/start");
});
