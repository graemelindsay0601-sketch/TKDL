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
  const root = document.getElementById("root")!;
  root.replaceChildren();
  createRoot(root).render(<App />);
}

type StartupStatus = { ready: boolean; phase: "starting" | "database" | "schema" | "ready" | "failed"; message: string };

function renderWakeScreen(message: string, elapsedSeconds: number) {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <main style="position:fixed;inset:0;display:grid;place-items:center;padding:24px;color:white;background:radial-gradient(circle at 18% 15%,rgba(255,0,92,.2),transparent 34%),radial-gradient(circle at 82% 85%,rgba(0,102,255,.18),transparent 36%),#05030b;font-family:Oswald,Arial,sans-serif">
      <section style="width:min(520px,100%);text-align:center">
        <div style="font-size:clamp(34px,10vw,64px);font-weight:950;font-style:italic;letter-spacing:-.045em;line-height:.9">TKDL <span style="color:#ff005c">LIVE</span></div>
        <div style="width:54px;height:4px;margin:24px auto;background:linear-gradient(90deg,#ff005c,#ffd24a);box-shadow:0 0 22px rgba(255,0,92,.7);animation:tkdl-wake 1.1s ease-in-out infinite alternate"></div>
        <h1 style="margin:0;font-size:22px;text-transform:uppercase;letter-spacing:.08em">Waking TKDL</h1>
        <p id="tkdl-wake-message" style="margin:9px 0 0;color:rgba(255,255,255,.52);font:500 13px/1.55 Inter,Arial,sans-serif"></p>
        <p id="tkdl-wake-time" style="margin:18px 0 0;color:rgba(255,255,255,.25);font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase"></p>
      </section>
      <style>@keyframes tkdl-wake{from{transform:scaleX(.35);opacity:.45}to{transform:scaleX(1);opacity:1}}</style>
    </main>`;
  const messageNode = document.getElementById("tkdl-wake-message");
  const timeNode = document.getElementById("tkdl-wake-time");
  if (messageNode) messageNode.textContent = message;
  if (timeNode) timeNode.textContent = `${elapsedSeconds}s · Score submission and standings will open together when ready`;
}

async function waitForServerReady(): Promise<void> {
  const startedAt = Date.now();
  renderWakeScreen("Connecting to the server…", 0);
  for (;;) {
    try {
      const response = await fetch("/api/startup", { cache: "no-store" });
      const status = await response.json() as StartupStatus;
      if (status.ready) return;
      renderWakeScreen(status.message || "Preparing the league…", Math.floor((Date.now() - startedAt) / 1000));
    } catch {
      renderWakeScreen("The server is still waking. Retrying automatically…", Math.floor((Date.now() - startedAt) / 1000));
    }
    await new Promise(resolve => window.setTimeout(resolve, 1_500));
  }
}

async function startApp() {
  if (!import.meta.env.DEV) {
    await waitForServerReady();
    renderApp();
    return;
  }

  if (!("serviceWorker" in navigator)) {
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
