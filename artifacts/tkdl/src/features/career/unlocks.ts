import { useHistory } from "./api";
import { UNLOCKS, unlockState, type UnlockKey } from "./unlocks-rules";
import type { CareerSave } from "./types";

export { UNLOCKS, markSeen, nextUnlockLine, type UnlockKey } from "./unlocks-rules";

const seen = (saveId: string, key: string) => { try { return localStorage.getItem(`tkdl-career-visited-${key}-${saveId}`) === "1"; } catch { return true; } };

export function useUnlocks(save: Pick<CareerSave, "id" | "currentSeason" | "status">) {
  const history = useHistory(save.id, { participant: "HUMAN" });
  const state = unlockState(save, history.data?.length ?? 0);
  // Until the history loads everything is shown, so nothing flickers away.
  const ready = !!history.data;
  return { ...state, ready, isOpen: (key: UnlockKey) => !ready || state.isOpen(key),
    isNew: (key: UnlockKey) => ready && !state.everything && UNLOCKS.some(u => u.key === key) && state.isOpen(key) && !seen(save.id, key) };
}

