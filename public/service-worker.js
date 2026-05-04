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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        try {
          await client.focus();
          if ("navigate" in client) await client.navigate(targetUrl);
          return;
        } catch (_) {
          // Fall through to opening a new client.
        }
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
