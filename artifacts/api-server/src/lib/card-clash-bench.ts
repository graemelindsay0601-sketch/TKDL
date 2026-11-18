import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Card Clash is benched (2026-11-18, at Graeme's request): no Card Clash routes, startup work, scheduled jobs, card
 * bonuses or seasonal quests run, and the web app makes no Card Clash calls. Nothing is deleted: tables, cards and
 * balances are kept as they are.
 *
 * Coins are TKDL's general currency (wallet, cosmetics, self-play unlocks, daily login, daily/weekly challenges) and keep
 * working, even though some of their endpoints still live under /api/card-clash.
 *
 * To bring Card Clash back: set CARD_CLASH_BENCHED=0 in the environment (or change the default here) and flip
 * CARD_CLASH_BENCHED in artifacts/tkdl/src/lib/card-clash-bench.ts.
 */
export const CARD_CLASH_BENCHED = process.env.CARD_CLASH_BENCHED !== "0";

/** Coins endpoints that live in the Card Clash router and stay open while it is benched (paths under /api/card-clash). */
const COINS_PATHS: readonly RegExp[] = [
  /^\/shop\/currency\/\d+\/?$/,
  /^\/login\/daily\/?$/, /^\/login\/streak\/\d+\/?$/, /^\/admin\/login\/reset\/\d+\/?$/,
  /^\/challenges\//, /^\/admin\/challenges\//,
  /^\/admin\/coins\//, /^\/debug\/coins\/\d+\/?$/,
];
export const isCoinsPath = (path: string) => COINS_PATHS.some(rule => rule.test(path));

/** While benched: Coins paths reach the router; every other Card Clash request is answered at once, without the database. */
export function benchedCardClash(router: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!CARD_CLASH_BENCHED || isCoinsPath(req.path)) { router(req, res, next); return; }
    res.status(410).json({ error: "Card Clash is not available right now", benched: true });
  };
}
