"use strict";

const CACHE_NAME = "codex-mobile-shell-v490";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/api-client.js",
  "/runtime-settings.js",
  "/draft-store.js",
  "/markdown-renderer.js",
  "/viewport-metrics.js",
  "/conversation-scroll.js",
  "/image-compressor.js",
  "/plugin-embed.js",
  "/plugin-voice-input.js",
  "/home-ai-diagnostic-reporting.js",
  "/thread-diagnostic-events.js",
  "/thread-status-hints.js",
  "/thread-performance-metrics.js",
  "/live-operation-dock-state.js",
  "/thread-detail-state.js",
  "/thread-detail-render-plan.js",
  "/thread-detail-merge-state.js",
  "/thread-detail-patch-plan.js",
  "/thread-detail-dom-patch.js",
  "/thread-detail-actions.js",
  "/thread-tile-actions.js",
  "/thread-tile-state.js",
  "/thread-tile-layout.js",
  "/build-refresh-policy.js",
  "/app.js",
  "/manifest.json",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

function shouldBypassCache(url) {
  return url.origin !== self.location.origin
    || url.pathname.startsWith("/api/")
    || url.pathname.startsWith("/uploads/");
}

function resolveAfter(ms, value) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (shouldBypassCache(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cached = await caches.match("/index.html");
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
            }
            return response;
          });
        if (cached) {
          return Promise.race([network, resolveAfter(1200, cached)]).catch(() => cached);
        }
        return network.catch(() => caches.match("/index.html"));
      })()
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      return cached || network;
    })
  );
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
  const data = Object.assign({ url: "/" }, payload.data || {});
  if (!data.threadId && payload.threadId) data.threadId = payload.threadId;
  if (!data.turnId && payload.turnId) data.turnId = payload.turnId;
  const options = {
    body: payload.body || "Codex update",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || "codex-mobile-web",
    data,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

function notificationTarget(notification) {
  const data = notification && notification.data ? notification.data : {};
  const url = new URL(data.url || "/", self.location.origin);
  const threadId = url.searchParams.get("thread") || data.threadId || "";
  if (threadId && !url.searchParams.get("thread")) {
    url.searchParams.set("thread", threadId);
  }
  return {
    url: url.href,
    threadId,
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
