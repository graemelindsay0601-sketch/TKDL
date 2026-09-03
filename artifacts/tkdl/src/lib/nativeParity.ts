// ── Native-app parity helpers ────────────────────────────────────────────────
// Small, isolated fixes for the gaps between our fullscreen web scorer and a
// real native scoring app (DartsMind/DartCounter-style): the screen dimming
// mid-leg, a stray pinch-zoom or back-swipe dropping you out of a live match,
// and a killed tab losing an in-progress match with no way back in. None of
// this needs a rewrite — these are all standard browser APIs, just not ones
// the scorer screens were opting into yet.
import { useEffect, useRef } from "react";

// ── Screen Wake Lock ───────────────────────────────────────────────────────
// Keeps the screen from dimming/locking while a match is live. Support is
// good on modern Android/desktop Chrome and Safari 16.4+; where it's missing
// entirely (older iOS Safari) this just quietly does nothing — no worse than
// today, never a hard failure.
export function useWakeLock(active: boolean): void {
  const lockRef = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };

    const requestLock = async () => {
      if (!nav.wakeLock?.request) return;
      try {
        const lock = await nav.wakeLock.request("screen");
        if (cancelled) { void lock.release(); return; }
        lockRef.current = lock;
      } catch {
        // Refused (e.g. low battery, no user gesture yet) — non-critical, skip silently.
      }
    };
    void requestLock();

    // The OS auto-releases the lock when the tab is backgrounded — re-acquire
    // it when the player comes back so checking a text mid-leg doesn't leave
    // the screen free to dim for the rest of the match.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void requestLock();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lockRef.current?.release();
      lockRef.current = null;
    };
  }, [active]);
}

// ── Pinch-zoom lock ────────────────────────────────────────────────────────
// The rest of the app leaves pinch-zoom on (handy for reading stats pages),
// but a stray two-finger touch shouldn't zoom the dartboard out mid-throw —
// no native scoring app allows that during play. Tightens the viewport meta
// tag only while a match is on screen, and restores whatever it was
// afterwards so the rest of the app is unaffected.
export function useZoomLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const meta = document.querySelector('meta[name="viewport"]');
    const original = meta?.getAttribute("content") ?? null;
    if (meta) {
      meta.setAttribute("content", "width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no");
    }
    return () => {
      if (meta && original !== null) meta.setAttribute("content", original);
    };
  }, [active]);
}

// ── Exit guard ─────────────────────────────────────────────────────────────
// A back-swipe (iOS) or back button (Android/desktop) mid-match currently
// falls straight through to whatever's behind the scorer with zero warning —
// a native app traps you until you explicitly forfeit. This arms a dummy
// history entry while a match is active and intercepts the resulting
// popstate with a confirmation before actually calling onExit (wire it to
// the same reset/abandon handler the Abandon button uses).
export function useExitGuard(active: boolean, onExit: () => void): void {
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  useEffect(() => {
    if (!active) return;
    history.pushState({ tkdlMatchGuard: true }, "", location.href);

    const onPopState = () => {
      const leave = window.confirm(
        "Leave this match? You'll need to abandon or finish it properly to record a result — going back now just drops you out."
      );
      if (leave) {
        onExitRef.current();
      } else {
        // Re-arm so the next back press/swipe is caught too.
        history.pushState({ tkdlMatchGuard: true }, "", location.href);
      }
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      // Undo the dummy entry on a clean exit (Win/Abandon button) so it
      // doesn't leave a stray entry sitting in the browser history.
      if ((history.state as { tkdlMatchGuard?: boolean } | null)?.tkdlMatchGuard) history.back();
    };
  }, [active]);
}

// ── Interrupted-match recovery ─────────────────────────────────────────────
// iOS Safari can silently kill a backgrounded tab under memory pressure —
// something a native app's process usually survives. Recovering the exact
// dart-by-dart state would mean every scorer engine serializing its own
// state, which isn't worth the complexity for how rarely this bites. What IS
// cheap: never lose the setup work (who's playing, what game, what stake).
// This snapshots that the moment a match goes live and clears it the moment
// the match ends normally (win or abandon) — so a snapshot still sitting
// there on load means last time ended mid-match, and the setup screen can
// offer a one-tap "same matchup again".
export function useMatchSnapshot<T>(key: string, active: boolean, data: T | null): void {
  useEffect(() => {
    if (!active || data == null) return;
    try { sessionStorage.setItem(key, JSON.stringify(data)); } catch { /* storage unavailable — non-critical */ }
    return () => {
      try { sessionStorage.removeItem(key); } catch { /* ignore */ }
    };
  }, [key, active, data]);
}

export function readMatchSnapshot<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearMatchSnapshot(key: string): void {
  try { sessionStorage.removeItem(key); } catch { /* ignore */ }
}
