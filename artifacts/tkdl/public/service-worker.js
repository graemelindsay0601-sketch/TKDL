/**
 * TKDL Service Worker
 * Handles web push notifications, offline support, and caching
 */

const CACHE_NAME = "tkdl-v7";
const API_CACHE = "tkdl-api-v7";

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
          // Cache successful API responses (clone before returning)
          if (response && response.status === 200) {
            const clonedResponse = response.clone();
            caches.open(API_CACHE).then((c) => c.put(request, clonedResponse));
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

  // The application shell must be network-first. Cache-first navigation used
  // to pin an old Vite entry module in development and could also keep a
  // deployed browser on an obsolete index.html after a new release.
  const isApplicationShell =
    request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname === "/index.html" ||
    url.pathname.startsWith("/src/") ||
    url.pathname.startsWith("/node_modules/");

  if (isApplicationShell) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clonedResponse));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => {
          return cached || new Response("Network error", { status: 503 });
        }))
    );
    return;
  }

  // Fingerprinted production assets and media: cache-first with network
  // fallback. Their URLs change when their contents change.
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clonedResponse));
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
    // Still report the ping even with no payload — the question this
    // answers is "did a push event fire on this device at all", which is
    // true here regardless of payload.
    event.waitUntil(reportPushReceived({ stage: "received_no_data" }));
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

  // Confirmed via the push-received diagnostic: showNotification() resolves
  // successfully (stage "shown_ok", no error) on every real device test, yet
  // nothing visibly appears. Every one of those tests shared the exact same
  // static tag ("tkdl-notification"). Per the Notifications spec, a new
  // notification sharing a tag with one already showing REPLACES it
  // in-place instead of raising a fresh alert — no banner, no sound, no
  // lock-screen appearance — unless renotify is explicitly set. A unique
  // tag per notification (falling back to a timestamp when there's no
  // notificationId, e.g. the "received_no_data" fallback path) plus
  // renotify:true as a belt-and-braces backstop means every push always
  // produces a real, new alert instead of a silent swap.
  const options = {
    body,
    icon,
    badge,
    tag: `tkdl-notification-${data.notificationId ?? Date.now()}`,
    renotify: true,
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

  // Confirmed live: the push event itself does fire correctly on-device
  // (see "Service worker reported a push event received on-device" in the
  // server logs). What's still unknown is whether showNotification() —
  // the actual call that's supposed to make iOS display a banner — is
  // succeeding, throwing, or resolving but getting silently suppressed by
  // the OS. Awaiting it explicitly and reporting the real outcome (instead
  // of Promise.allSettled swallowing whichever one failed) answers that
  // directly on the next test rather than needing another guess.
  event.waitUntil(
    (async () => {
      await reportPushReceived({ notificationId: data.notificationId, title, stage: "received" });
      try {
        await self.registration.showNotification(title, options);
        await reportPushReceived({ notificationId: data.notificationId, title, stage: "shown_ok" });
      } catch (err) {
        await reportPushReceived({
          notificationId: data.notificationId,
          title,
          stage: "show_failed",
          error: String(err && err.message ? err.message : err),
        });
      }
    })()
  );
});

function reportPushReceived(details) {
  return fetch("/api/notifications/push-received", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...details, swScriptUrl: self.location.href }),
  }).catch(() => {
    // Nothing to do if this fails — it's a diagnostic, not core behavior.
  });
}

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  const { action, notification } = event;

  notification.close();

  if (action === "close") {
    return;
  }

  // Every notification used to just open "/" regardless of what it was
  // about — fine for a generic alert, but useless for something time-boxed
  // like an Interview Desk invite, where tapping the banner needs to land
  // you on the actual question, not the home screen, with the window
  // already closing behind you. sendPushNotification's payload now
  // includes a `url` in its data for any notification type that sets one
  // (see notificationService.ts) — this just honours it when present and
  // falls back to the old "/" behaviour for every notification that
  // doesn't, so nothing about existing notification types changes.
  const targetUrl = (notification.data && notification.data.url) || "/";

  // Find and focus a window already on that exact page, or open a new one
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        const clientPath = (() => { try { return new URL(client.url).pathname; } catch { return client.url; } })();
        if (clientPath === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      // Not already open on that page — focus any open window and
      // navigate it there if we can, otherwise open a fresh one.
      if (clientList.length > 0 && "navigate" in clientList[0] && "focus" in clientList[0]) {
        return clientList[0].navigate(targetUrl).then((c) => c && c.focus());
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
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
