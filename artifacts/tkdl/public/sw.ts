/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

const CACHE_VERSION = "v1-2026-06-25";
const CACHE_NAMES = {
  STATIC: `${CACHE_VERSION}-static`,
  DYNAMIC: `${CACHE_VERSION}-dynamic`,
  API: `${CACHE_VERSION}-api`,
  IMAGES: `${CACHE_VERSION}-images`,
};

// Assets to cache on install
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json",
];

// Clean up old caches
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => !Object.values(CACHE_NAMES).includes(name))
          .map((name) => caches.delete(name))
      );
    })
  );

  event.waitUntil(
    caches.open(CACHE_NAMES.STATIC).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Offline install is OK - some assets may not be available
        console.warn("Could not cache all static assets on install");
      });
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Fetch strategy: Network-first for API, Cache-first for static
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip chrome extensions and non-GET requests
  if (url.protocol === "chrome-extension:" || request.method !== "GET") {
    return;
  }

  // API calls - network first, fallback to cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cache = caches.open(CACHE_NAMES.API);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return (
              cached ||
              new Response(
                JSON.stringify({ error: "Offline - cached data unavailable" }),
                { status: 503, headers: { "Content-Type": "application/json" } }
              )
            );
          });
        })
    );
    return;
  }

  // Images - cache first, fallback to network
  if (
    request.destination === "image" ||
    url.pathname.includes("/assets/") ||
    url.pathname.includes("/card-artwork/") ||
    url.pathname.includes("/cards/")
  ) {
    event.respondWith(
      caches
        .match(request)
        .then((cached) => {
          if (cached) return cached;
          return fetch(request)
            .then((response) => {
              if (response.ok) {
                caches.open(CACHE_NAMES.IMAGES).then((cache) => {
                  cache.put(request, response.clone());
                });
              }
              return response;
            })
            .catch(() => {
              // Return a placeholder if image not available
              return new Response(
                `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#333" width="100" height="100"/></svg>`,
                { headers: { "Content-Type": "image/svg+xml" } }
              );
            });
        })
        .catch(() => {
          // Return placeholder SVG
          return new Response(
            `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#333" width="100" height="100"/></svg>`,
            { headers: { "Content-Type": "image/svg+xml" } }
          );
        })
    );
    return;
  }

  // HTML and JS - cache, fallback to network, then offline page
  if (
    request.destination === "document" ||
    request.destination === "script" ||
    request.destination === "style"
  ) {
    event.respondWith(
      caches
        .match(request)
        .then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAMES.DYNAMIC).then((cache) => {
                cache.put(request, response.clone());
              });
            }
            return response;
          });
        })
        .catch(() => {
          // Fallback for offline
          if (request.destination === "document") {
            return caches
              .match("/")
              .then(
                (cached) =>
                  cached ||
                  new Response("App offline - please reconnect", {
                    status: 503,
                    statusText: "Service Unavailable",
                  })
              );
          }
          return new Response("Resource offline", { status: 503 });
        })
    );
    return;
  }

  // Default strategy
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request).then((cached) => {
        return (
          cached ||
          new Response("Resource offline", { status: 503 })
        );
      });
    })
  );
});

// Push notifications
self.addEventListener("push", (event) => {
  let data = {
    title: "TKDL 🎯",
    body: "New notification",
    icon: "/icon-192.png",
    url: "/",
  };

  try {
    if (event.data) {
      data = { ...data, ...JSON.parse(event.data.text()) };
    }
  } catch (e) {
    console.error("Push parse error:", e);
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: "/icon-192.png",
      tag: "tkdl-notification",
      data: { url: data.url },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    })
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Message handler for cache updates
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
