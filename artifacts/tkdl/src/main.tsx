import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

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
if ("serviceWorker" in navigator) {
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

createRoot(document.getElementById("root")!).render(<App />);
