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
// /service-worker.js is the app's single worker for the root scope. Keeping
// push handling, offline shell caching and update detection in one script
// prevents registrations from replacing each other on player devices.
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

// The pre-mount splash (index.html's #tkdl-splash) is static markup shown
// before this module even finished loading, so it has to be removed from
// here rather than ever rendered/unmounted by React. Called from the two
// points below that actually have something real to show in its place —
// idempotent, since renderWakeScreen can fire repeatedly while polling.
function removeSplash() {
  const splash = document.getElementById("tkdl-splash");
  if (!splash) return;
  splash.classList.add("tkdl-splash-out");
  window.setTimeout(() => splash.remove(), 450);
}

function renderApp() {
  const root = document.getElementById("root")!;
  root.replaceChildren();
  createRoot(root).render(<App />);
  removeSplash();
}

type StartupPhase = "starting" | "database" | "schema" | "ready" | "failed";
type StartupStatus = { ready: boolean; phase: StartupPhase; message: string };

// Order the 3-dot tracker below actually walks through. index.ts's
// initializeApplication() calls setStartupPhase("database", ...) then,
// only on a genuine cold boot, setStartupPhase("schema", ...) — "starting"
// is whatever phase field a status response carries before the first of
// those calls lands. "failed" isn't a fourth stage: markStartupFailed()
// is followed by index.ts retrying initializeApplication() from the top
// (setTimeout(..., 10_000)), so the honest thing for the tracker to do on
// a failure is reset to the first dot, same as the backend actually does,
// not invent a fourth "error" stage that doesn't exist server-side.
const WAKE_PHASE_ORDER: StartupPhase[] = ["starting", "database", "schema"];
function wakePhaseIndex(phase: StartupPhase): number {
  if (phase === "ready") return WAKE_PHASE_ORDER.length;
  const i = WAKE_PHASE_ORDER.indexOf(phase);
  return i === -1 ? 0 : i; // "failed" (or anything unrecognized) → back to the first dot
}

// Same mark/ring/dart/spark/wordmark markup and animation as index.html's
// #tkdl-splash (and tkdl-loader.css's React version) — deliberately
// duplicated rather than shared, since this runs before React has mounted
// anything. Keep all three in sync if you tune colors/timing. removeSplash()
// here hands off from the static pre-mount splash to this screen the first
// time it renders, with the two looking identical so there's no visible
// jump — only the dynamic message/time text and the phase tracker below
// the mark change after that, as this gets called again on every poll.
//
// The tracker's three dots are driven by `phase`, which comes straight from
// GET /api/startup's own `phase` field (see waitForServerReady below) — not
// a local timer or a guess. updateWakePhaseTracker() just toggles "done"/
// "active" classes off wakePhaseIndex(phase); there's no separate animation
// faking progress, so what you see is exactly what index.ts's own
// setStartupPhase() calls have reported.
function renderWakeScreen(message: string, elapsedSeconds: number, phase: StartupPhase) {
  const root = document.getElementById("root");
  if (!root) return;
  if (!document.getElementById("tkdl-wake-message")) {
    root.innerHTML = `
      <main style="position:fixed;inset:0;display:grid;place-items:center;padding:24px;color:white;background:radial-gradient(circle at 18% 15%,rgba(255,0,92,.2),transparent 34%),radial-gradient(circle at 82% 85%,rgba(0,102,255,.18),transparent 36%),radial-gradient(circle at 85% 12%,rgba(255,210,74,.10),transparent 30%),radial-gradient(circle at 12% 88%,rgba(139,92,246,.09),transparent 32%),#05030b;font-family:Oswald,Arial,sans-serif">
        <section style="width:min(420px,100%);text-align:center">
          <div class="tkdl-mark-wrap" style="width:150px;height:150px;margin:0 auto">
            <div class="tkdl-mark-glow"></div>
            <div class="tkdl-mark-ring"></div>
            <div class="tkdl-mark-ring-inner"></div>
            <img class="tkdl-mark-img" src="/icon-192.png" alt="TKDL" />
            <div class="tkdl-dart">
              <span class="tkdl-dart-flight"></span>
              <span class="tkdl-dart-shaft"></span>
              <span class="tkdl-dart-tip"></span>
            </div>
            <div class="tkdl-impact"></div>
            <span class="tkdl-spark"></span><span class="tkdl-spark"></span><span class="tkdl-spark"></span>
            <span class="tkdl-spark"></span><span class="tkdl-spark"></span><span class="tkdl-spark"></span>
          </div>
          <div class="tkdl-word" style="margin-top:20px"><b>TKDL</b><small>Tesco Kilbirnie Darts League</small></div>
          <h1 style="margin:22px 0 0;font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.75)">Waking the League</h1>
          <p id="tkdl-wake-message" style="margin:9px 0 0;color:rgba(255,255,255,.52);font:500 13px/1.55 Inter,Arial,sans-serif"></p>

          <div class="tkdl-phases" style="display:flex;align-items:center;justify-content:center;gap:0;margin-top:22px">
            <div class="tkdl-phase" id="tkdl-phase-0" style="display:flex;flex-direction:column;align-items:center;gap:7px;width:76px">
              <div class="tkdl-phase-dot"></div><div class="tkdl-phase-label">Connect</div>
            </div>
            <div class="tkdl-phase-line" id="tkdl-phase-line-0"></div>
            <div class="tkdl-phase" id="tkdl-phase-1" style="display:flex;flex-direction:column;align-items:center;gap:7px;width:76px">
              <div class="tkdl-phase-dot"></div><div class="tkdl-phase-label">Database</div>
            </div>
            <div class="tkdl-phase-line" id="tkdl-phase-line-1"></div>
            <div class="tkdl-phase" id="tkdl-phase-2" style="display:flex;flex-direction:column;align-items:center;gap:7px;width:76px">
              <div class="tkdl-phase-dot"></div><div class="tkdl-phase-label">League data</div>
            </div>
          </div>

          <p id="tkdl-wake-time" style="margin:16px 0 0;color:rgba(255,255,255,.25);font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase"></p>
        </section>
        <style>
          .tkdl-mark-glow{position:absolute;inset:-16%;border-radius:30%;background:radial-gradient(circle,rgba(255,0,92,.5),transparent 70%);filter:blur(18px);animation:tkdl-glow-pulse 2.2s ease-in-out infinite}
          .tkdl-mark-ring{position:absolute;inset:-12%;border-radius:50%;background:conic-gradient(from 0deg,#ff005c,#ffd24a 30%,transparent 52%,transparent 100%);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 3px));animation:tkdl-ring-spin 3.2s linear infinite;opacity:.9}
          .tkdl-mark-ring-inner{position:absolute;inset:-5%;border-radius:50%;background:conic-gradient(from 180deg,#38bdf8,#8b5cf6 40%,transparent 58%,transparent 100%);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 2px));mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 2px));animation:tkdl-ring-spin-rev 2.6s linear infinite;opacity:.65}
          .tkdl-mark-img{position:relative;z-index:1;width:100%;height:100%;border-radius:22%;object-fit:cover;display:block;box-shadow:0 10px 26px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.06)}
          @keyframes tkdl-glow-pulse{0%,100%{opacity:.5;transform:scale(.95)}50%{opacity:1;transform:scale(1.05)}}
          @keyframes tkdl-ring-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
          @keyframes tkdl-ring-spin-rev{from{transform:rotate(0)}to{transform:rotate(-360deg)}}
          .tkdl-dart{position:absolute;top:50%;left:50%;width:56px;height:10px;margin-top:-5px;margin-left:-56px;transform-origin:100% 50%;z-index:2;animation:tkdl-dart-throw 2.4s cubic-bezier(.33,.9,.4,1) infinite}
          .tkdl-dart-shaft{position:absolute;right:5px;left:12px;top:50%;height:3px;margin-top:-1.5px;background:linear-gradient(90deg,#8a8a99,#e8e8f2);border-radius:2px}
          .tkdl-dart-tip{position:absolute;right:-2px;top:50%;width:0;height:0;margin-top:-5px;border-style:solid;border-width:5px 0 5px 13px;border-color:transparent transparent transparent #ffd24a;filter:drop-shadow(0 0 4px rgba(255,210,74,.7))}
          .tkdl-dart-flight{position:absolute;left:0;top:50%;width:17px;height:17px;margin-top:-8.5px;background:linear-gradient(135deg,#ff005c,#ff6b9d);clip-path:polygon(0 50%,100% 0,68% 50%,100% 100%)}
          .tkdl-impact{position:absolute;top:50%;left:50%;width:9px;height:9px;margin:-4.5px;border-radius:50%;border:2px solid #ffd24a;opacity:0;z-index:2;animation:tkdl-impact-ring 2.4s cubic-bezier(.33,.9,.4,1) infinite}
          .tkdl-spark{position:absolute;top:50%;left:50%;width:4px;height:4px;border-radius:1px;margin:-2px;z-index:2;opacity:0;animation:tkdl-spark-fly 2.4s cubic-bezier(.33,.9,.4,1) infinite}
          .tkdl-spark:nth-of-type(1){background:#ffd24a;--a:-70deg}
          .tkdl-spark:nth-of-type(2){background:#ff005c;--a:-25deg}
          .tkdl-spark:nth-of-type(3){background:#ffd24a;--a:20deg}
          .tkdl-spark:nth-of-type(4){background:#ff6b9d;--a:65deg}
          .tkdl-spark:nth-of-type(5){background:#ffd24a;--a:140deg}
          .tkdl-spark:nth-of-type(6){background:#ff005c;--a:-150deg}
          @keyframes tkdl-dart-throw{0%{transform:translate(56px,-66px) rotate(18deg) scale(.55);opacity:0}16%{opacity:1}54%{transform:translate(0,0) rotate(-24deg) scale(1);opacity:1}80%{transform:translate(0,0) rotate(-24deg) scale(1);opacity:1}94%{transform:translate(0,0) rotate(-24deg) scale(1);opacity:0}100%{transform:translate(56px,-66px) rotate(18deg) scale(.55);opacity:0}}
          @keyframes tkdl-impact-ring{0%,52%{transform:scale(0);opacity:0}58%{transform:scale(1);opacity:.85}80%{transform:scale(2.6);opacity:0}100%{opacity:0}}
          @keyframes tkdl-spark-fly{0%,54%{transform:rotate(var(--a)) translateY(0);opacity:0}60%{opacity:1}78%{transform:rotate(var(--a)) translateY(-26px);opacity:0}100%{opacity:0}}
          .tkdl-word b{display:block;font-size:clamp(1.8rem,7vw,2.6rem);font-weight:800;letter-spacing:.2em;color:#fff;text-shadow:0 0 24px rgba(255,0,60,.55);font-family:Oswald,Arial,sans-serif}
          .tkdl-word small{display:block;margin-top:7px;font-size:.62rem;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.4)}
          .tkdl-phase-dot{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.14);transition:all .3s ease}
          .tkdl-phase-label{font-size:.55rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.3);transition:color .3s ease}
          .tkdl-phase-line{width:34px;height:2px;background:rgba(255,255,255,.1);margin:0 -2px;transform:translateY(-12px);transition:background .3s ease}
          .tkdl-phase.done .tkdl-phase-dot{background:#ffd24a;border-color:#ffd24a;box-shadow:0 0 8px rgba(255,210,74,.5)}
          .tkdl-phase.done .tkdl-phase-label{color:rgba(255,210,74,.85)}
          .tkdl-phase.active .tkdl-phase-dot{background:#ff005c;border-color:#ff005c;box-shadow:0 0 0 4px rgba(255,0,92,.25),0 0 10px rgba(255,0,92,.6);animation:tkdl-phase-pulse 1.1s ease-in-out infinite}
          .tkdl-phase.active .tkdl-phase-label{color:#fff}
          .tkdl-phase-line.done{background:#ffd24a}
          @keyframes tkdl-phase-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.35)}}
        </style>
      </main>`;
    removeSplash();
  }
  const messageNode = document.getElementById("tkdl-wake-message");
  const timeNode = document.getElementById("tkdl-wake-time");
  if (messageNode) messageNode.textContent = message;
  if (timeNode) timeNode.textContent = `${elapsedSeconds}s · Score submission and standings will open together when ready`;
  updateWakePhaseTracker(phase);
}

function updateWakePhaseTracker(phase: StartupPhase) {
  const activeIndex = wakePhaseIndex(phase);
  for (let i = 0; i < WAKE_PHASE_ORDER.length; i++) {
    const dot = document.getElementById(`tkdl-phase-${i}`);
    if (dot) {
      dot.classList.toggle("done", i < activeIndex);
      dot.classList.toggle("active", i === activeIndex);
    }
    if (i < WAKE_PHASE_ORDER.length - 1) {
      const line = document.getElementById(`tkdl-phase-line-${i}`);
      if (line) line.classList.toggle("done", i < activeIndex);
    }
  }
}

async function waitForServerReady(): Promise<void> {
  const startedAt = Date.now();
  let lastKnownPhase: StartupPhase = "starting";
  renderWakeScreen("Connecting to the server…", 0, lastKnownPhase);
  for (;;) {
    try {
      const response = await fetch("/api/startup", { cache: "no-store" });
      const status = await response.json() as StartupStatus;
      if (status.ready) return;
      lastKnownPhase = status.phase;
      renderWakeScreen(status.message || "Preparing the league…", Math.floor((Date.now() - startedAt) / 1000), lastKnownPhase);
    } catch {
      // A fetch failure (network blip, Render still routing to the old
      // instance) carries no phase info of its own — keep showing whatever
      // phase we last actually heard from the server rather than guessing.
      renderWakeScreen("The server is still waking. Retrying automatically…", Math.floor((Date.now() - startedAt) / 1000), lastKnownPhase);
    }
    await new Promise(resolve => window.setTimeout(resolve, 1_500));
  }
}

// Locked app screen: iOS Safari ignores user-scalable=no for pinch gestures,
// so cancel its proprietary gesture events to stop accidental zooms that
// break the fixed layout (see styles/viewport.css).
for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
  document.addEventListener(type, event => event.preventDefault(), { passive: false });
}

// iOS home-screen apps can open (or resume) with a wrong viewport height that
// floats the fixed bottom nav well above the home indicator until the page is
// scrolled. Nudge the document by a pixel and back so it settles at once.
function settleIosViewport() {
  if (!/iP(hone|ad|od)/.test(navigator.userAgent)) return;
  const nudge = () => {
    const y = window.scrollY;
    window.scrollTo(0, y + 1);
    requestAnimationFrame(() => window.scrollTo(0, y));
  };
  window.addEventListener("load", () => setTimeout(nudge, 50));
  window.addEventListener("pageshow", () => setTimeout(nudge, 50));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(nudge, 50);
  });
  window.addEventListener("orientationchange", () => setTimeout(nudge, 300));
}
settleIosViewport();

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
