import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth";

/**
 * Which X01 scorer a player uses:
 *  - "total":   type the visit score (default)
 *  - "perdart": enter each dart
 *  - "classic": the original scorer, unchanged
 * Saved on the player's account; a per-device copy covers signed-out use and
 * the moment before /api/auth/me answers.
 */
export type ScorerStyle = "total" | "perdart" | "classic";
export const SCORER_STYLES: ScorerStyle[] = ["total", "perdart", "classic"];
export const DEFAULT_SCORER_STYLE: ScorerStyle = "total";
const KEY = "tkdl:scorer-style";

// One-off (Nov 2026): a Classic choice saved on this device while the new
// scorer was being tried out is cleared once, so the new default shows.
// Picking Classic again afterwards sticks.
const RESET_KEY = "tkdl:scorer-style-reset-2026-11";
function resetOnce() {
  try {
    if (localStorage.getItem(RESET_KEY)) return;
    if (localStorage.getItem(KEY) === "classic") localStorage.removeItem(KEY);
    localStorage.setItem(RESET_KEY, "1");
  } catch { /* storage off */ }
}

function readLocal(): ScorerStyle | null {
  resetOnce();
  try {
    const v = localStorage.getItem(KEY);
    return SCORER_STYLES.includes(v as ScorerStyle) ? (v as ScorerStyle) : null;
  } catch { return null; }
}
function writeLocal(v: ScorerStyle) {
  try { localStorage.setItem(KEY, v); } catch { /* storage off: account copy still applies */ }
}

export function useScorerStyle(): [ScorerStyle, (next: ScorerStyle) => Promise<boolean>] {
  const { user, refresh } = useAuth();
  const [local, setLocal] = useState<ScorerStyle | null>(() => readLocal());
  const account = user?.scorerStyle ?? null;
  useEffect(() => { if (account && account !== local) { writeLocal(account); setLocal(account); } }, [account]); // eslint-disable-line react-hooks/exhaustive-deps
  const style: ScorerStyle = account ?? local ?? DEFAULT_SCORER_STYLE;
  const set = useCallback(async (next: ScorerStyle) => {
    writeLocal(next); setLocal(next);
    if (!user) return true;
    try {
      const res = await fetch("/api/auth/scorer-style", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: next }),
      });
      if (!res.ok) return false;
      await refresh();
      return true;
    } catch { return false; }
  }, [user, refresh]);
  return [style, set];
}
