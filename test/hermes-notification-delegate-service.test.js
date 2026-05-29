"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createHermesNotificationDelegateService,
  normalizeNotificationPayload,
} = require("../adapters/hermes-notification-delegate-service");

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body || {}),
  };
}

function sampleNotification(overrides = {}) {
  return Object.assign({
    workspaceId: "owner",
    eventId: "turn-completed-thread-1-turn-1",
    title: "Codex turn completed",
    summary: "A Codex task completed.",
    itemType: "info",
    priority: "normal",
    route: {
      name: "thread",
      tab: "codex",
      itemId: "thread-1",
      threadId: "thread-1",
      taskId: "turn-1",
    },
  }, overrides);
}

test("delegates successful plugin notifications to Hermes Action Inbox", async () => {
  const calls = [];
  const service = createHermesNotificationDelegateService({
    baseUrl: "https://hermes.example.test:8445",
    webKey: "hermes-owner-key",
    fetchImpl: async (url, options) => {
      calls.push({ url, options, body: JSON.parse(options.body) });
      return jsonResponse(200, {
        ok: true,
        inboxItem: {
          id: "inbox_1",
          eventId: "turn-completed-thread-1-turn-1",
          pluginId: "codex-mobile",
          route: { name: "thread", tab: "codex", itemId: "thread-1" },
        },
      });
    },
  });

  const result = await service.send(sampleNotification());

  assert.equal(result.inboxItem.id, "inbox_1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://hermes.example.test:8445/api/hermes-plugins/codex-mobile/notifications");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["X-Hermes-Web-Key"], "hermes-owner-key");
  assert.equal(calls[0].body.eventId, "turn-completed-thread-1-turn-1");
  assert.equal(calls[0].body.route.itemId, "thread-1");
  assert.equal(calls[0].body.route.threadId, "thread-1");
  assert.equal(calls[0].body.route.taskId, "turn-1");
  assert.doesNotMatch(calls[0].options.body, /hermes-owner-key|Bearer|push endpoint/i);
});

test("keeps duplicate stable eventIds unchanged so Hermes can dedupe Inbox items", async () => {
  const eventIds = [];
  const service = createHermesNotificationDelegateService({
    baseUrl: "https://hermes.example.test",
    webKey: "hermes-owner-key",
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      eventIds.push(body.eventId);
      return jsonResponse(200, {
        ok: true,
        inboxItem: { id: "inbox_same", eventId: body.eventId },
      });
    },
  });

  const first = await service.send(sampleNotification({ eventId: "stable-event-id" }));
  const second = await service.send(sampleNotification({ eventId: "stable-event-id" }));

  assert.deepEqual(eventIds, ["stable-event-id", "stable-event-id"]);
  assert.equal(first.inboxItem.id, "inbox_same");
  assert.equal(second.inboxItem.id, "inbox_same");
});

test("passes notify false and openMode plugin as safe route metadata", async () => {
  let sentBody = null;
  const service = createHermesNotificationDelegateService({
    baseUrl: "https://hermes.example.test",
    webKey: "hermes-owner-key",
    fetchImpl: async (_url, options) => {
      sentBody = JSON.parse(options.body);
      return jsonResponse(200, {
        ok: true,
        inboxItem: {
          id: "inbox_plugin",
          eventId: sentBody.eventId,
          route: sentBody.route,
        },
      });
    },
  });

  const result = await service.send(sampleNotification({
    eventId: "plugin-open-event",
    notify: false,
    openMode: "plugin",
    route: { name: "thread", tab: "review", itemId: "thread-2" },
  }));

  assert.equal(sentBody.notify, false);
  assert.equal(sentBody.openMode, "plugin");
  assert.deepEqual(sentBody.route, { name: "thread", tab: "review", itemId: "thread-2" });
  assert.equal(result.inboxItem.id, "inbox_plugin");
});

test("passes bounded detailMessage content for Hermes inbox/thread detail storage", async () => {
  let sentBody = null;
  const service = createHermesNotificationDelegateService({
    baseUrl: "https://hermes.example.test",
    webKey: "hermes-owner-key",
    fetchImpl: async (_url, options) => {
      sentBody = JSON.parse(options.body);
      return jsonResponse(200, {
        ok: true,
        inboxItem: {
          id: "inbox_detail",
          eventId: sentBody.eventId,
          route: sentBody.route,
        },
      });
    },
  });

  await service.send(sampleNotification({
    detailMessage: {
      format: "markdown",
      sourceTurnId: "turn-1",
      body: "# Thread title\n\n## 最终回执\n\nDone.",
      truncated: true,
    },
  }));

  assert.deepEqual(sentBody.detailMessage, {
    format: "markdown",
    sourceTurnId: "turn-1",
    body: "# Thread title\n\n## 最终回执\n\nDone.",
    truncated: true,
  });
});

test("surfaces unauthorized Hermes workspace or key responses without leaking key material", async () => {
  const service = createHermesNotificationDelegateService({
    baseUrl: "https://hermes.example.test",
    webKey: "bad-hermes-key",
    fetchImpl: async () => jsonResponse(403, { error: "forbidden" }),
  });

  await assert.rejects(
    () => service.send(sampleNotification()),
    (err) => err.statusCode === 403 && /unauthorized/.test(err.message),
  );
});

test("can derive Hermes notification endpoint from workspace callback registration", async () => {
  let calledUrl = "";
  const service = createHermesNotificationDelegateService({
    webKey: "hermes-owner-key",
    registrationForWorkspace: () => ({
      callbackUrl: "https://hermes.example.test/api/plugins/codex-mobile/callback",
    }),
    fetchImpl: async (url) => {
      calledUrl = url;
      return jsonResponse(200, { ok: true, inboxItem: { id: "inbox_derived" } });
    },
  });

  assert.equal(service.isConfiguredForWorkspace("owner"), true);
  await service.send(sampleNotification());
  assert.equal(calledUrl, "https://hermes.example.test/api/hermes-plugins/codex-mobile/notifications");
});

test("reads Hermes notification key from a server-side file only", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-hermes-notify-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const keyFile = path.join(dir, "hermes.key");
  fs.writeFileSync(keyFile, "file-hermes-key\n", "utf8");
  let headerKey = "";
  const service = createHermesNotificationDelegateService({
    baseUrl: "https://hermes.example.test",
    webKeyFile: keyFile,
    fetchImpl: async (_url, options) => {
      headerKey = options.headers["X-Hermes-Web-Key"];
      return jsonResponse(200, { ok: true, inboxItem: { id: "inbox_file_key" } });
    },
  });

  await service.send(sampleNotification());
  assert.equal(headerKey, "file-hermes-key");
  assert.doesNotMatch(JSON.stringify(service.notificationContract()), /file-hermes-key|hermes\.key/);
});

test("rejects unsafe notification payload content before sending", () => {
  assert.throws(() => normalizeNotificationPayload(sampleNotification({
    accessKey: "must-not-send",
  })), /notification_field_not_allowed:accessKey/);
  assert.throws(() => normalizeNotificationPayload(sampleNotification({
    route: { name: "thread", content: "long page content" },
  })), /route_field_not_allowed:content/);
  assert.throws(() => normalizeNotificationPayload(sampleNotification({
    summary: "Bearer abcdefghijklmnopqrstuvwxyz",
  })), /summary_contains_unsafe_value/);
  assert.throws(() => normalizeNotificationPayload(sampleNotification({
    detailMessage: { format: "html", body: "nope" },
  })), /detail_message_format_invalid/);
  assert.throws(() => normalizeNotificationPayload(sampleNotification({
    eventId: "",
    sourceId: "",
  })), /event_id_required/);
});
