"use strict";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function pushPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch (_) {
    return { body: event.data.text() };
  }
}

self.addEventListener("push", (event) => {
  const payload = pushPayload(event);
  const title = payload.title || "Codex Mobile Web";
  const options = {
    body: payload.body || "Codex update",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: payload.tag || "codex-mobile-web",
    data: Object.assign({ url: "/" }, payload.data || {}),
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

function notificationTarget(notification) {
  const data = notification && notification.data ? notification.data : {};
  const url = new URL(data.url || "/", self.location.origin);
  return {
    url: url.href,
    threadId: url.searchParams.get("thread") || data.threadId || "",
  };
}

function postNotificationTarget(client, target) {
  if (!client || !("postMessage" in client)) return;
  client.postMessage({
    type: "codex-open-thread",
    url: target.url,
    threadId: target.threadId,
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = notificationTarget(event.notification);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        try {
          const focused = await client.focus();
          postNotificationTarget(focused || client, target);
          return;
        } catch (_) {
          // Fall through to opening a new client.
        }
      }
    }
    if (self.clients.openWindow) {
      const opened = await self.clients.openWindow(target.url);
      postNotificationTarget(opened, target);
    }
  })());
});
