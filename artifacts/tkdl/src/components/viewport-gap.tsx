import { useEffect, useState } from "react";

// Some iOS home-screen installs report a layout viewport that already stops
// above the home indicator. Adding env(safe-area-inset-bottom) to the fixed
// bottom nav then counts that strip twice and lifts the icons well clear of
// the screen edge. Measure the missing strip and expose it as a CSS variable
// so the nav can subtract it from its safe-area padding.
function measureBottomGap(): number {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!standalone) return 0;
  const portrait = window.innerHeight >= window.innerWidth;
  const screenHeight = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  return Math.max(0, Math.round(screenHeight - window.innerHeight));
}

export function useViewportBottomGap() {
  useEffect(() => {
    const apply = () => document.documentElement.style.setProperty("--tkdl-viewport-bottom-gap", `${measureBottomGap()}px`);
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    document.addEventListener("visibilitychange", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      document.removeEventListener("visibilitychange", apply);
    };
  }, []);
}

const DEBUG_KEY = "tkdl-vpdebug";

function readDebugFlag(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get("vpdebug");
    if (param !== null) localStorage.setItem(DEBUG_KEY, param === "0" ? "0" : "1");
    return localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return new URLSearchParams(window.location.search).has("vpdebug");
  }
}

// Shows the numbers the bottom nav is working with. Home-screen apps can't take
// a URL parameter, so tapping the TKDL logo in the mobile header five times
// within three seconds toggles it too (?vpdebug=1 / ?vpdebug=0 also work).
export function ViewportDebug() {
  const [enabled, setEnabled] = useState(readDebugFlag);
  const [info, setInfo] = useState("");
  useEffect(() => {
    let taps: number[] = [];
    const onClick = (event: MouseEvent) => {
      if (!(event.target as Element | null)?.closest?.(".tkdl-mobile-brand")) return;
      const now = Date.now();
      taps = [...taps.filter(t => now - t < 3000), now];
      if (taps.length < 5) return;
      taps = [];
      setEnabled(on => {
        try { localStorage.setItem(DEBUG_KEY, on ? "0" : "1"); } catch { /* storage unavailable */ }
        return !on;
      });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
    document.body.appendChild(probe);
    const update = () => {
      const p = getComputedStyle(probe);
      const nav = document.querySelector("nav.tkdl-app-nav")?.getBoundingClientRect();
      setInfo([
        `standalone ${window.matchMedia("(display-mode: standalone)").matches}`,
        `screen ${screen.width}x${screen.height}`,
        `inner ${window.innerWidth}x${window.innerHeight}`,
        `visual ${Math.round(window.visualViewport?.height ?? 0)}`,
        `html ${document.documentElement.clientHeight}`,
        `safe top ${p.paddingTop} bottom ${p.paddingBottom}`,
        `gap ${measureBottomGap()}px`,
        nav ? `nav top ${Math.round(nav.top)} h ${Math.round(nav.height)} bottom ${Math.round(nav.bottom)}` : "nav -",
        navigator.userAgent.replace(/^.*?\(/, "(").slice(0, 80),
      ].join("\n"));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => { window.clearInterval(timer); probe.remove(); };
  }, [enabled]);
  if (!enabled) return null;
  return (
    <pre style={{ position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 60px)", left: 8, right: 8, zIndex: 9999, margin: 0, padding: 10, fontSize: 12, lineHeight: 1.4, whiteSpace: "pre-wrap", color: "#0f0", background: "rgba(0,0,0,0.85)", border: "1px solid #0f0", borderRadius: 8, pointerEvents: "none" }}>
      {info}
    </pre>
  );
}
