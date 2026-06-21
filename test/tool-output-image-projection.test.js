"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const generatedImageCacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-tool-output-images-"));
const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-tool-output-uploads-"));
process.env.CODEX_MOBILE_GENERATED_IMAGE_CACHE_DIR = generatedImageCacheRoot;
process.env.CODEX_MOBILE_UPLOAD_DIR = uploadRoot;
process.env.CODEX_MOBILE_ROLLOUT_CONTEXT_BYTES = String(256 * 1024);
process.env.CODEX_MOBILE_ROLLOUT_ENRICHMENT_CONTEXT_BYTES = String(512 * 1024);

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

test("view_image outputs for uploaded user images are not repeated as agent image cards", () => {
  const uploadPath = path.join(uploadRoot, "2026-06-19", "thread-upload", "IMG_1635.png");
  fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
  fs.writeFileSync(uploadPath, Buffer.from("iVBORw0KGgo=", "base64"));
  const { dir, rolloutPath } = writeRollout([
    event("2026-06-19T08:00:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-upload" }),
    event("2026-06-19T08:00:01.000Z", "response_item", {
      type: "message",
      role: "user",
      content: [{
        type: "input_text",
        text: `PWA?\n\nUploaded attachments:\n- IMG_1635.png (image, image/png, 218.0 KB): ${uploadPath}`,
      }],
    }),
    event("2026-06-19T08:00:02.000Z", "response_item", {
      type: "function_call",
      name: "view_image",
      call_id: "call-view-upload",
      arguments: JSON.stringify({ path: uploadPath, detail: "high" }),
    }),
    event("2026-06-19T08:00:03.000Z", "response_item", {
      type: "function_call_output",
      call_id: "call-view-upload",
      output: [{ type: "input_image", image_url: "data:image/png;base64,iVBORw0KGgo=" }],
    }),
  ]);
  try {
    const compacted = compactThread({
      id: "thread-upload-image",
      path: rolloutPath,
      turns: [{
        id: "turn-upload",
        status: { type: "completed" },
        items: [{ id: "agent-1", type: "agentMessage", text: "checked screenshot" }],
      }],
    });

    assert.equal(compacted.turns[0].items.some((item) => item.type === "imageView"), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("uploaded view_image suppression uses the incremental rollout index beyond the ordinary tail", () => {
  const uploadPath = path.join(uploadRoot, "2026-06-21", "thread-upload", "large-tail-upload.png");
  fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
  fs.writeFileSync(uploadPath, Buffer.from("iVBORw0KGgo=", "base64"));
  const { dir, rolloutPath } = writeRollout([
    event("2026-06-21T08:00:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-large-tail" }),
    event("2026-06-21T08:00:01.000Z", "response_item", {
      type: "message",
      role: "user",
      content: [{
        type: "input_text",
        text: `Uploaded attachments:\n- large-tail-upload.png (image, image/png, 10.0 KB): ${uploadPath}`,
      }],
    }),
    event("2026-06-21T08:00:02.000Z", "response_item", {
      type: "function_call",
      name: "view_image",
      call_id: "call-view-large-tail-upload",
      arguments: JSON.stringify({ path: uploadPath, detail: "high" }),
    }),
    event("2026-06-21T08:00:03.000Z", "event_msg", {
      type: "agent_reasoning",
      message: "x".repeat(300 * 1024),
    }),
    event("2026-06-21T08:00:04.000Z", "response_item", {
      type: "function_call_output",
      call_id: "call-view-large-tail-upload",
      output: [{ type: "input_image", image_url: "data:image/png;base64,iVBORw0KGgo=" }],
    }),
  ]);
  try {
    const compacted = compactThread({
      id: "thread-large-tail-upload",
      path: rolloutPath,
      turns: [{
        id: "turn-large-tail",
        status: { type: "completed" },
        items: [{ id: "agent-1", type: "agentMessage", text: "checked screenshot" }],
      }],
    });

    assert.equal(compacted.turns[0].items.some((item) => item.type === "imageView"), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("direct imageView items for uploaded user images are not repeated beside upload summaries", () => {
  const uploadPath = path.join(uploadRoot, "2026-06-20", "thread-upload", "homeai-upload-76E2D26C.jpg");
  fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
  fs.writeFileSync(uploadPath, Buffer.from("iVBORw0KGgo=", "base64"));

  const compacted = compactThread({
    id: "thread-direct-upload-image-view",
    turns: [{
      id: "turn-upload",
      status: { type: "completed" },
      items: [
        {
          id: "user-upload",
          type: "userMessage",
          content: [{
            type: "input_text",
            text: `Uploaded attachments:\n- homeai-upload-76E2D26C.jpg (image, image/jpeg, 123.3 KB): ${uploadPath}`,
          }],
        },
        {
          id: "call-view-upload",
          type: "imageView",
          path: uploadPath,
        },
        {
          id: "agent-1",
          type: "agentMessage",
          text: "checked screenshot",
        },
      ],
    }],
  });

  assert.deepEqual(compacted.turns[0].items.map((item) => item.id), ["user-upload", "agent-1"]);
  assert.equal(compacted.turns[0].items.some((item) => item.type === "imageView"), false);
});

test("direct imageView upload paths remain visible without a matching user upload summary", () => {
  const uploadPath = path.join(uploadRoot, "2026-06-20", "thread-upload", "standalone-image-view.jpg");
  fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
  fs.writeFileSync(uploadPath, Buffer.from("iVBORw0KGgo=", "base64"));

  const compacted = compactThread({
    id: "thread-standalone-upload-image-view",
    turns: [{
      id: "turn-upload",
      status: { type: "completed" },
      items: [
        {
          id: "call-view-upload",
          type: "imageView",
          path: uploadPath,
        },
        {
          id: "agent-1",
          type: "agentMessage",
          text: "checked screenshot",
        },
      ],
    }],
  });

  const image = compacted.turns[0].items.find((item) => item.type === "imageView");
  assert.ok(image);
  assert.equal(image.id, "call-view-upload");
  assert.match(image.contentUrl, /^\/api\/generated-images\/file\?id=/);
});

test("view_image outputs outside the upload directory still become image cards", () => {
  const outsidePath = path.join(os.tmpdir(), "codex-mobile-outside-view-image.png");
  const { dir, rolloutPath } = writeRollout([
    event("2026-06-19T08:05:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-outside" }),
    event("2026-06-19T08:05:02.000Z", "response_item", {
      type: "function_call",
      name: "view_image",
      call_id: "call-view-outside",
      arguments: JSON.stringify({ path: outsidePath, detail: "high" }),
    }),
    event("2026-06-19T08:05:03.000Z", "response_item", {
      type: "function_call_output",
      call_id: "call-view-outside",
      output: [{ type: "input_image", image_url: "data:image/png;base64,QUJD" }],
    }),
  ]);
  try {
    const compacted = compactThread({
      id: "thread-outside-image",
      path: rolloutPath,
      turns: [{
        id: "turn-outside",
        status: { type: "completed" },
        items: [{ id: "agent-1", type: "agentMessage", text: "checked screenshot" }],
      }],
    });

    const image = compacted.turns[0].items.find((item) => item.type === "imageView");
    assert.ok(image);
    assert.match(image.id, /^tool-output-image-call-view-outside-0-/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("inline image data urls in compacted string payloads are redacted", () => {
  const compacted = compactThread({
    id: "thread-inline-image-redaction",
    turns: [{
      id: "turn-inline",
      status: { type: "completed" },
      items: [{
        id: "agent-1",
        type: "agentMessage",
        content: ["before data:image/png;base64,iVBORw0KGgo= after"],
      }],
    }],
  });

  const [content] = compacted.turns[0].items[0].content;
  assert.doesNotMatch(content, /data:image\//);
  assert.match(content, /\[inline image data omitted: \d+ chars\]/);
});

test("unscoped tool output image data urls attach to matching turn time windows", () => {
  const { dir, rolloutPath } = writeRollout([
    event("2026-06-08T10:00:02.000Z", "response_item", {
      type: "function_call_output",
      call_id: "call-old-image",
      output: [{ type: "input_image", image_url: "data:image/png;base64,QUJD" }],
    }),
    event("2026-06-08T10:05:02.000Z", "response_item", {
      type: "function_call_output",
      call_id: "call-new-image",
      output: [{ type: "input_image", image_url: "data:image/png;base64,REVG" }],
    }),
  ]);
  try {
    const compacted = compactThread({
      id: "thread-unscoped-images",
      path: rolloutPath,
      turns: [
        {
          id: "turn-old",
          startedAtMs: Date.parse("2026-06-08T10:00:00.000Z"),
          completedAtMs: Date.parse("2026-06-08T10:00:30.000Z"),
          status: { type: "completed" },
          items: [{ id: "agent-old", type: "agentMessage", text: "old turn" }],
        },
        {
          id: "turn-new",
          startedAtMs: Date.parse("2026-06-08T10:05:00.000Z"),
          completedAtMs: Date.parse("2026-06-08T10:05:30.000Z"),
          status: { type: "completed" },
          items: [{ id: "agent-new", type: "agentMessage", text: "new turn" }],
        },
      ],
    }, { maxTurns: 2 });

    const oldImages = compacted.turns[0].items.filter((item) => item.type === "imageView");
    const newImages = compacted.turns[1].items.filter((item) => item.type === "imageView");
    assert.equal(oldImages.length, 1);
    assert.equal(newImages.length, 1);
    assert.match(oldImages[0].id, /^tool-output-image-call-old-image-0-/);
    assert.match(newImages[0].id, /^tool-output-image-call-new-image-0-/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test.after(() => {
  fs.rmSync(generatedImageCacheRoot, { recursive: true, force: true });
  fs.rmSync(uploadRoot, { recursive: true, force: true });
});
