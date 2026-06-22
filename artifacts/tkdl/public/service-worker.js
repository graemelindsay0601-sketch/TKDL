/**
 * TKDL Service Worker
 * Handles web push notifications, offline support, and caching
 */

const CACHE_NAME = "tkdl-v1";
const API_CACHE = "tkdl-api-v1";

// Files to cache for offline support
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
];

// Install: cache assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Ignore errors - some assets may not exist yet
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // API calls: network-first with fallback to cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response && response.status === 200) {
            const cache = caches.open(API_CACHE);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // Fallback to cached response if network fails
          return caches.match(request).then((cached) => {
            return cached || new Response("Network error", { status: 503 });
          });
        })
    );
    return;
  }

  // Static assets: cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).then((response) => {
          if (response && response.status === 200) {
            const cache = caches.open(CACHE_NAME);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
      );
    })
  );
});

// Handle push notifications
self.addEventListener("push", (event) => {
  if (!event.data) {
    console.log("Push received but no data");
    return;
  }

  let notificationData;
  try {
    notificationData = event.data.json();
  } catch {
    notificationData = {
      title: "TKDL Notification",
      body: event.data.text(),
    };
  }

  const {
    title,
    body,
    icon = "/icon-192.png",
    badge = "/icon-192.png",
    data = {},
  } = notificationData;

  const options = {
    body,
    icon,
    badge,
    tag: "tkdl-notification",
    requireInteraction: false,
    actions: [
      { action: "open", title: "Open" },
      { action: "close", title: "Dismiss" },
    ],
    data: {
      timestamp: Date.now(),
      ...data,
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  const { action, notification } = event;

  notification.close();

  if (action === "close") {
    return;
  }

  // Find and focus the app window, or open a new one
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Check if app is already open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      // If not open, open it
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});

// Handle notification close
self.addEventListener("notificationclose", (event) => {
  const { notification } = event;
  const { data } = notification;

  // Log that notification was closed
  if (data?.notificationId) {
    // Could send analytics here if needed
    console.log("Notification closed:", data.notificationId);
  }
});
