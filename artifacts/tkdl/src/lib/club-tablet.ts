import { useEffect, useState } from "react";

/**
 * Club tablet mode: a per-device switch (set in Admin with the PIN) for the
 * shared tablet at work. Nobody needs to log in to play or submit; this mode
 * just makes the device behave like a shared one — no personal prompts,
 * back to the Hub when left idle, and any player who signs in on it is
 * signed out again after a spell of no use.
 */
const KEY = "tkdl:club-tablet";
const EVT = "tkdl:club-tablet-change";

export function isClubTablet(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function setClubTablet(on: boolean) {
  try { on ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY); } catch { /* storage off */ }
  window.dispatchEvent(new Event(EVT));
}

export function useClubTablet(): boolean {
  const [on, setOn] = useState(isClubTablet);
  useEffect(() => {
    const sync = () => setOn(isClubTablet());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return on;
}

/** Pages where a game may be in progress — never yanked away from. */
export const TABLET_BUSY_PATHS = ["/play", "/practice", "/matchday", "/master501", "/shadow-bot", "/boss-battle", "/board-curse", "/career", "/tour"];
export const TABLET_IDLE_MS = 5 * 60 * 1000;
