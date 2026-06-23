"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createRolloutEnrichmentIndexService,
} = require("../adapters/rollout-enrichment-index-service");

function tempRollout() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-rollout-index-"));
  return {
    dir,
    file: path.join(dir, "rollout.jsonl"),
  };
}

function writeLine(file, value, mode = "a") {
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`, { encoding: "utf8", flag: mode });
}

test("rollout enrichment index parses only appended jsonl bytes", () => {
  const { dir, file } = tempRollout();
  let parseCalls = 0;
  const service = createRolloutEnrichmentIndexService({
    parseJsonLine(line) {
      parseCalls += 1;
      return JSON.parse(line);
    },
  });
  try {
    writeLine(file, { type: "turn_context", payload: { turn_id: "turn-1" } }, "w");

    const first = service.read(file);
    assert.equal(first.entries.length, 1);
    assert.equal(first.parsedLines, 1);
    assert.equal(parseCalls, 1);
    assert.equal(first.cacheHit, false);

    writeLine(file, { type: "event_msg", payload: { type: "token_count" } });
    const second = service.read(file);
    assert.equal(second.entries.length, 2);
    assert.equal(second.parsedLines, 1);
    assert.equal(parseCalls, 2);
    assert.equal(second.cacheHit, false);

    const third = service.read(file);
    assert.equal(third.entries.length, 2);
    assert.equal(third.parsedLines, 0);
    assert.equal(parseCalls, 2);
    assert.equal(third.cacheHit, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("rollout enrichment index exposes a parseable final jsonl line without trailing newline", () => {
  const { dir, file } = tempRollout();
  const service = createRolloutEnrichmentIndexService();
  try {
    writeLine(file, { type: "turn_context", payload: { turn_id: "turn-1" } }, "w");
    fs.writeFileSync(file, JSON.stringify({
      type: "event_msg",
      payload: {
        type: "task_complete",
        turn_id: "turn-1",
      },
    }), { encoding: "utf8", flag: "a" });

    const first = service.read(file);
    assert.equal(first.entries.length, 2);
    assert.equal(first.provisionalEntryCount, 1);
    assert.equal(first.entries[1].payload.type, "task_complete");

    const second = service.read(file);
    assert.equal(second.entries.length, 2);
    assert.equal(second.provisionalEntryCount, 1);
    assert.equal(second.cacheHit, true);

    fs.writeFileSync(file, "\n", { encoding: "utf8", flag: "a" });
    const afterNewline = service.read(file);
    assert.equal(afterNewline.entries.length, 2);
    assert.equal(afterNewline.provisionalEntryCount, 0);
    assert.equal(afterNewline.entries[1].payload.type, "task_complete");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("rollout enrichment index does not expose an incomplete final jsonl fragment", () => {
  const { dir, file } = tempRollout();
  const service = createRolloutEnrichmentIndexService();
  try {
    writeLine(file, { type: "turn_context", payload: { turn_id: "turn-1" } }, "w");
    fs.writeFileSync(file, "{\"type\":\"event_msg\",\"payload\":", { encoding: "utf8", flag: "a" });

    const incomplete = service.read(file);
    assert.equal(incomplete.entries.length, 1);
    assert.equal(incomplete.provisionalEntryCount, 0);

    fs.writeFileSync(file, "{\"type\":\"task_complete\",\"turn_id\":\"turn-1\"}}\n", { encoding: "utf8", flag: "a" });
    const completed = service.read(file);
    assert.equal(completed.entries.length, 2);
    assert.equal(completed.provisionalEntryCount, 0);
    assert.equal(completed.entries[1].payload.type, "task_complete");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("rollout enrichment index resets when rollout file is truncated", () => {
  const { dir, file } = tempRollout();
  const service = createRolloutEnrichmentIndexService();
  try {
    writeLine(file, { type: "turn_context", payload: { turn_id: "old-turn" } }, "w");
    writeLine(file, { type: "event_msg", payload: { type: "agent_message" } });
    assert.equal(service.read(file).entries.length, 2);

    writeLine(file, { type: "turn_context", payload: { turn_id: "new-turn" } }, "w");
    const afterTruncate = service.read(file);
    assert.equal(afterTruncate.entries.length, 1);
    assert.equal(afterTruncate.entries[0].payload.turn_id, "new-turn");
    assert.equal(afterTruncate.resetCount, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
