"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const generatedImageCacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-tool-output-images-"));
process.env.CODEX_MOBILE_GENERATED_IMAGE_CACHE_DIR = generatedImageCacheRoot;

const {
  compactThread,
} = require("../server");

function writeRollout(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-tool-output-rollout-"));
  const rolloutPath = path.join(dir, "rollout-2026-06-08T10-00-00-019ea77e-4e36-7820-adf4-9bf0272965b8.jsonl");
  fs.writeFileSync(rolloutPath, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
  return { dir, rolloutPath };
}

function event(timestamp, type, payload = {}) {
  return { timestamp, type, payload };
}

test("function_call_output input_image data urls become generated image cards", () => {
  const { dir, rolloutPath } = writeRollout([
    event("2026-06-08T10:00:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-image" }),
    event("2026-06-08T10:00:02.000Z", "response_item", {
      type: "function_call_output",
      call_id: "call-view-image",
      output: [
        {
          type: "input_image",
          image_url: "data:image/png;base64,iVBORw0KGgo=",
        },
      ],
    }),
  ]);
  try {
    const compacted = compactThread({
      id: "019ea77e-4e36-7820-adf4-9bf0272965b8",
      path: rolloutPath,
      turns: [{
        id: "turn-image",
        status: { type: "completed" },
        items: [{ id: "agent-1", type: "agentMessage", text: "visual check" }],
      }],
    });

    const image = compacted.turns[0].items.find((item) => item.type === "imageView");
    assert.ok(image);
    assert.match(image.id, /^tool-output-image-call-view-image-0-/);
    assert.match(image.contentUrl, /^\/api\/generated-images\/file\?id=/);
    assert.equal(image.url, undefined);
    assert.equal(image.generatedImage.contentType, "image/png");
    assert.equal(image.startedAtMs, Date.parse("2026-06-08T10:00:02.000Z"));

    const id = new URLSearchParams(image.contentUrl.split("?")[1]).get("id");
    const cachedPath = path.join(generatedImageCacheRoot, ...id.split("/"));
    assert.equal(fs.readFileSync(cachedPath).toString("base64"), "iVBORw0KGgo=");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test.after(() => {
  fs.rmSync(generatedImageCacheRoot, { recursive: true, force: true });
});
