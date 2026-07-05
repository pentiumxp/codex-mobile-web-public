"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createRolloutDetailEnrichmentService,
} = require("../adapters/rollout-detail-enrichment-service");

function tempRollout() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-rollout-detail-enrichment-"));
  return {
    dir,
    file: path.join(dir, "rollout.jsonl"),
  };
}

function appendLine(file, value, mode = "a") {
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`, { encoding: "utf8", flag: mode });
}

test("rollout detail enrichment avoids full index reads for large rollout files", () => {
  const { dir, file } = tempRollout();
  let indexReadCount = 0;
  const largePayload = "x".repeat(150 * 1024);
  try {
    appendLine(file, { type: "event_msg", payload: { seq: 1, text: largePayload } }, "w");
    appendLine(file, { type: "event_msg", payload: { seq: 2, text: largePayload } });
    appendLine(file, { type: "event_msg", payload: { seq: 3, text: largePayload } });

    const service = createRolloutDetailEnrichmentService({
      maxRolloutContextBytes: 256 * 1024,
      maxRuntimeContextScanBytes: 256 * 1024,
      maxRolloutEnrichmentContextBytes: 256 * 1024,
      rolloutEnrichmentIndexService: {
        read() {
          indexReadCount += 1;
          return {
            readError: false,
            entries: [{ type: "event_msg", payload: { seq: "indexed" } }],
          };
        },
      },
    });

    const entries = service.readRolloutEnrichmentEntries(file);
    assert.equal(indexReadCount, 0);
    assert.deepEqual(entries.map((entry) => entry.payload.seq), [3]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("rollout detail enrichment still uses incremental index for bounded rollout files", () => {
  const { dir, file } = tempRollout();
  let indexReadCount = 0;
  try {
    appendLine(file, { type: "event_msg", payload: { seq: 1 } }, "w");

    const service = createRolloutDetailEnrichmentService({
      maxRuntimeContextScanBytes: 1024,
      maxRolloutEnrichmentContextBytes: 128,
      rolloutEnrichmentIndexService: {
        read(rolloutPath) {
          indexReadCount += 1;
          assert.equal(rolloutPath, file);
          return {
            readError: false,
            entries: [{ type: "event_msg", payload: { seq: "indexed" } }],
          };
        },
      },
    });

    const entries = service.readRolloutEnrichmentEntries(file);
    assert.equal(indexReadCount, 1);
    assert.deepEqual(entries.map((entry) => entry.payload.seq), ["indexed"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
