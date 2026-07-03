"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createAtLoopTriggerParserService,
  parseAtLoopTrigger,
  redactSensitiveText,
} = require("../services/at-loop/at-loop-trigger-parser-service");

test("at-loop parser accepts generic trigger", () => {
  const parsed = parseAtLoopTrigger("@loop ship bounded runtime");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.triggered, true);
  assert.equal(parsed.domainAdapter, "generic");
  assert.equal(parsed.objectiveSummary, "ship bounded runtime");
});

test("at-loop parser accepts home-ai domain trigger", () => {
  const parsed = parseAtLoopTrigger("@home-ai @loop repair Owner Console status", {
    knownAliases: ["home-ai"],
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.triggered, true);
  assert.equal(parsed.targetAlias, "home-ai");
  assert.equal(parsed.domainAdapter, "home-ai");
});

test("at-loop parser accepts known plugin alias and rejects unknown aliases", () => {
  const service = createAtLoopTriggerParserService({ knownAliases: ["finance"] });
  const known = service.parse("@finance @loop reconcile import state");
  assert.equal(known.ok, true);
  assert.equal(known.targetAlias, "finance");
  assert.equal(known.domainAdapter, "plugin");

  const unknown = service.parse("@unknown-plugin @loop do work");
  assert.equal(unknown.ok, false);
  assert.equal(unknown.error, "at_loop_unknown_target_alias");
  assert.equal(unknown.targetAlias, "unknown-plugin");
});

test("at-loop parser redacts sensitive-looking objective metadata", () => {
  const text = redactSensitiveText("fix password=SECRET_VALUE token=abc123456789 Authorization: Bearer abcdefghijklmnop");
  assert.doesNotMatch(text, /SECRET_VALUE|abc123456789|abcdefghijklmnop/);
  assert.match(text, /password=\[redacted\]/);
  const parsed = parseAtLoopTrigger("@loop use apiKey=VALUE123456789 safely");
  assert.doesNotMatch(JSON.stringify(parsed), /VALUE123456789/);
});
