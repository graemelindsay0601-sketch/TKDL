import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Vite speculatively <link rel="modulepreload">s chunks it predicts a route
// will need, separately from the dynamic import() calls lazy-with-retry.ts
// wraps. When one of those preloads fails — same root cause: a request
// landing while the server's mid-boot after a cold start gets the SPA's
// index.html back instead of the real file — Vite dispatches this event on
// window instead of throwing into React. Same fix: reload once, guarded so
// a genuinely broken deploy doesn't reload forever.
window.addEventListener("vite:preloadError", () => {
  let alreadyReloaded = false;
  try {
    alreadyReloaded = sessionStorage.getItem("chunk-reload:preload") === "1";
  } catch {
    // ignore — treat as not-yet-reloaded
  }
  if (alreadyReloaded) return;
  try {
    sessionStorage.setItem("chunk-reload:preload", "1");
  } catch {
    // best-effort
  }
  window.location.reload();
});

// Register service worker with update detection.
//
// This used to register /sw.js while use-push-notifications.ts separately
// registered /service-worker.js — two different scripts fighting over the
// same "/" scope. Only one script can actually control the page at a time,
// so depending on registration order/timing, push subscriptions set up
// against one script's registration could end up controlled by the other's
// (mismatched) push/notificationclick handlers, or churn every time either
// one re-registered. /service-worker.js is the one whose push handler
// actually matches the payload shape the backend sends (title/body/icon/
// badge/data — see sendPushNotification in notificationService.ts); /sw.js
// expected a different shape and is no longer registered anywhere.
if ("serviceWorker" in navigator && !import.meta.env.DEV) {
  // Tapping a push notification when the app's already open (backgrounded,
  // or on a home-screen PWA) needs the window to land on that notification's
  // own page — e.g. a specific interview — not wherever it happened to be
  // left open. The service worker's notificationclick handler tried
  // client.navigate() for that, but that call is unreliable on iOS/Safari
  // standalone PWAs (it can resolve without the page actually changing), so
  // a real test just brought the already-open app back to its last page
  // instead. Posting the target URL here and doing the navigation from the
  // page's own already-running JS is the reliable way to move an
  // already-open client — see service-worker.js's "tkdl-navigate" postMessage.
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "tkdl-navigate" && typeof event.data.url === "string") {
      window.location.href = event.data.url;
    }
  });

  navigator.serviceWorker
    .register("/service-worker.js", { scope: "/" })
    .then((registration) => {
      // Check for updates every 6 hours
      setInterval(() => {
        registration.update();
      }, 6 * 60 * 60 * 1000);

      // Listen for updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New service worker ready, notify user
              console.log("App update available - will load on next refresh");
              window.dispatchEvent(
                new CustomEvent("sw-update", { detail: { registration } })
              );
            }
          });
        }
      });

      console.log("Service Worker registered successfully");
    })
    .catch((error) => {
      console.warn("Service Worker registration failed:", error);
    });
}

function renderApp() {
  createRoot(document.getElementById("root")!).render(<App />);
}

async function startApp() {
  if (!import.meta.env.DEV || !("serviceWorker" in navigator)) {
    renderApp();
    return;
  }

  // A production service worker must never control Vite's development
  // modules. Its cached dependency chunks can outlive an optimise/restart
  // cycle and mix two React runtimes, which surfaces as an "Invalid hook
  // call" even though the component's hooks are valid.
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map(registration => registration.unregister()));
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
  }

  if (navigator.serviceWorker.controller) {
    window.location.reload();
    return;
  }

  renderApp();
}

void startApp();
