import type { NextFunction, Request, Response } from "express";
import { bumpSaveVersion, saveVersion } from "./save-version.ts";

/**
 * Remembers Career screen reads until the save changes, so going back to Home, the Guide, Inbox or the calendar is
 * instant instead of recomputed. Safe by construction:
 * - keyed by the signed-in player and the exact URL (query included), so an answer only ever goes back to the player
 *   it was computed for;
 * - tagged with the save's change counter at the start of the request and served only while it is unchanged;
 * - not stored when the save changed within the last SETTLE_MS (the first reads after a change run the week's
 *   upkeep, and a read racing that upkeep could otherwise keep an older view), nor for answers that aren't 200;
 * - expires after TTL_MS whatever happens, and live screens (scorer sessions, tournaments in play, streams) are
 *   never cached.
 * CAREER_READ_CACHE=0 turns it off.
 */
const TTL_MS = 120_000, MAX_ENTRIES = 400, MAX_BODY = 1_500_000, MAX_TOTAL = 40_000_000;
const CACHED = /^\/saves\/([0-9a-f-]{36})\/(calendar(\/season-plan)?|dart-stats|guide|guidance|inbox|commercial-inbox|goals|history|milestones|records|recognition|relationships|life|legacy(\/summary|\/player|\/seasons\/\d+)?|sponsors(\/market)?|sporting|finance(\/ledger|\/weeks|\/goal|\/purchases)?|tour-card|q-school|qualification|pathways|rankings(-movers|\/[A-Za-z0-9_:-]+(\/history|\/explain)?)?|trophy-cabinet|world-content|world-localities|world-map|world-players|entitlements|form|club|club\/team-nights|club\/local-competitions|local|nights|hosting|road-trips|pro-am|manager|cam-league|money-matches|equipment-studio|presentation|profile)$/;
const SAVE_PATH = /^\/saves\/([0-9a-f-]{36})(\/|$)/;

type Entry = { version: number; at: number; body: string; size: number };
const entries = new Map<string, Entry>();
let total = 0;
const enabled = () => process.env.CAREER_READ_CACHE !== "0";
const settleMs = () => Number(process.env.CAREER_READ_CACHE_SETTLE_MS ?? 5_000);

function remember(key: string, entry: Entry) {
  forget(key);
  entries.set(key, entry); total += entry.size;
  for (const [k] of entries) { if (entries.size <= MAX_ENTRIES && total <= MAX_TOTAL) break; forget(k); }
}
function forget(key: string) {
  const old = entries.get(key);
  if (old) { total -= old.size; entries.delete(key); }
}

export function careerReadCache(req: Request, res: Response, next: NextFunction) {
  if (!enabled()) { next(); return; }
  const path = req.path;
  if (req.method !== "GET") {
    // Any change through the API: bump again when it finishes (lockRoot bumped when it took the save).
    const write = SAVE_PATH.exec(path);
    if (write) res.on("finish", () => bumpSaveVersion(write[1]!));
    next(); return;
  }
  const match = CACHED.exec(path);
  const session = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
  if (!match || !Number.isSafeInteger(session?.playerId)) { next(); return; }
  const saveId = match[1]!, key = `${session!.playerId}|${session!.isAdmin === true}|${req.originalUrl}`;
  const now = Date.now(), current = saveVersion(saveId);
  const hit = entries.get(key);
  if (hit && hit.version === current.version && now - hit.at < TTL_MS) {
    entries.delete(key); entries.set(key, hit); // most recently used last
    res.set("Cache-Control", "no-store").set("X-Career-Cache", "hit").type("application/json").send(hit.body);
    return;
  }
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    const after = saveVersion(saveId);
    if (res.statusCode === 200 && after.version === current.version && now - current.changedAt >= settleMs()) {
      const text = JSON.stringify(body);
      if (text.length <= MAX_BODY) remember(key, { version: current.version, at: now, body: text, size: text.length });
    }
    return json(body);
  };
  next();
}

/** Tests: start from an empty cache. */
export function clearCareerReadCache() { entries.clear(); total = 0; }
