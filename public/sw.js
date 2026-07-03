"use strict";

importScripts("/shell-asset-manifest.js");

const SHELL_MANIFEST = self.CODEX_MOBILE_SHELL_MANIFEST || {};
const CACHE_NAME = String(SHELL_MANIFEST.shellCacheName || "codex-mobile-shell-v625");
const STATIC_ASSETS = Object.freeze(Array.isArray(SHELL_MANIFEST.precacheAssets)
  ? SHELL_MANIFEST.precacheAssets.slice()
  : ["/", "/index.html", "/styles.css", "/shell-asset-manifest.js", "/app-bootstrap.js", "/app.js", "/manifest.json"]);

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

function isShellReloadNavigation(url) {
  return url.searchParams.has("shellReload")
    || url.searchParams.has("codexMobileBuild")
    || url.searchParams.has("codexViteShell");
}

function shouldNetworkFirstShellAsset(url) {
  const path = url.pathname;
  return path === "/sw.js"
    || path === "/shell-asset-manifest.js"
    || path === "/shell-asset-manifest.json"
    || path === "/vite-shell/app-preview.html"
    || path === "/vite-shell/preview.html"
    || path === "/vite-shell/app-preview-entry.js"
    || /^\/vite-shell\/assets\/vite-shell-entry-[^/]+\.js$/.test(path);
}

async function putOkResponse(cacheKey, response) {
  if (!response || !response.ok) return;
  const copy = response.clone();
  const cache = await caches.open(CACHE_NAME);
  await cache.put(cacheKey, copy);
}

async function networkFirst(request, cacheKey = request) {
  const cached = await caches.match(cacheKey);
  try {
    const response = await fetch(request, { cache: "reload" });
    await putOkResponse(cacheKey, response);
    return response;
  } catch (_) {
    if (cached) return cached;
    throw _;
  }
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
        if (isShellReloadNavigation(url)) {
          return networkFirst(request, "/index.html");
        }
        const cached = await caches.match("/index.html");
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              putOkResponse("/index.html", response).catch(() => {});
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

  if (shouldNetworkFirstShellAsset(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response && response.ok) {
          putOkResponse(request, response).catch(() => {});
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
    renotify: false,
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
