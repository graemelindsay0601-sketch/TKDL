/**
 * Achievements v2 running for real: a switch in settings, a debounced background sync after anything that records a result,
 * and the admin controls. Nothing runs until an admin turns the switch on (the first sync is the history credit).
 */
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { logger } from "../logger";
import { getSetting, setSetting } from "../settingsService";
import { getDefaultLeagueId } from "../currentLeague";
import { addCoinsToPlayer } from "../../services/card-shop-service";
import { ensurePlayerCurrency } from "../cardTablesMigration";
import { syncAll, ENABLED_KEY, type Setting, type SyncResult } from "./store.ts";

export const settings: Setting = {
  get: async key => getSetting(await getDefaultLeagueId(), key),
  set: async (key, value) => setSetting(await getDefaultLeagueId(), key, value),
};
export const isEnabled = async () => (await settings.get(ENABLED_KEY)) === "true";

const pay = async (playerId: number, coins: number, detail: string) => {
  try { await ensurePlayerCurrency(playerId); await addCoinsToPlayer(playerId, coins, "achievement", detail); }
  catch (err) { logger.error({ err, playerId, detail }, "achievements v2: coin payment failed"); }
};

let running: Promise<SyncResult | null> = Promise.resolve(null);
let timer: NodeJS.Timeout | null = null;
export let lastSync: (SyncResult & { at: string }) | { error: string; at: string } | null = null;

/** Run one sync now, after any that is already running (never two at once). */
export function syncNow(force = false): Promise<SyncResult | null> {
  running = running.catch(() => null).then(async () => {
    if (!force && !(await isEnabled())) return null;
    try {
      const r = await syncAll(db as never, settings, pay);
      lastSync = { ...r, at: new Date().toISOString() };
      logger.info(r, "achievements v2 sync");
      return r;
    } catch (err) {
      lastSync = { error: String((err as Error)?.message ?? err), at: new Date().toISOString() };
      logger.error({ err }, "achievements v2 sync failed");
      return null;
    }
  });
  return running;
}

const DEBOUNCE_MS = Number(process.env.ACHIEVEMENTS_V2_DEBOUNCE_MS ?? 8000);
/** Results usually arrive in bursts (a night's matches), so wait for a quiet moment and sync once. */
export function scheduleSync() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void syncNow(); }, DEBOUNCE_MS);
  timer.unref?.();
}

// Anything that records a result. Matched on the path below /api.
const RESULT_PATHS = /^\/(matches|team-matches|live-match|doubles|shift-wars|practice|master501|board-curse|boss-battles|career|admin\/(matches|seasons|doubles|shift-wars))\b/;
/** After a successful write to a results route, queue a sync. Cheap when the switch is off (one settings read, later). */
export function achievementsV2Trigger(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "GET" && RESULT_PATHS.test(req.path)) res.on("finish", () => { if (res.statusCode < 400) scheduleSync(); });
  next();
}
