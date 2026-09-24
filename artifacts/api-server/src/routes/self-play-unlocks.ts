import { Router } from "express";
import {
  db, playerCurrencyTable, currencyTransactionsTable,
  selfPlayUnlockDefinitionsTable, playerSelfPlayUnlocksTable,
} from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";
import { getActiveUnlockIds } from "../services/self-play-unlocks-service";

const router = Router();

// Same session-ownership helper as routes/cosmetics.ts.
function sessionPlayerId(req: any): number | null {
  return (req.session as any)?.playerId ?? null;
}

// GET /api/self-play-unlocks/catalog — the full enabled catalog. Public,
// same reasoning as GET /api/cosmetics/catalog: the setup-screen UI needs
// this to render prices/descriptions for locked items before the player
// has bought anything.
router.get("/self-play-unlocks/catalog", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(selfPlayUnlockDefinitionsTable)
      .where(eq(selfPlayUnlockDefinitionsTable.enabled, true))
      .orderBy(asc(selfPlayUnlockDefinitionsTable.category), asc(selfPlayUnlockDefinitionsTable.sortOrder));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to get self-play unlocks catalog");
    res.status(500).json({ error: "Failed to get self-play unlocks catalog" });
  }
});

// GET /api/players/:id/self-play-unlocks — this player's currently-active
// unlock ids (expired Preview Pass rows excluded). Session-owner-only,
// unlike the cosmetics equivalent — nobody but the player themselves ever
// needs to know what's unlocked here, this never renders on another
// player's profile.
router.get("/players/:id/self-play-unlocks", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }

    const sessionId = sessionPlayerId(req);
    if (!sessionId) { res.status(401).json({ error: "Login required" }); return; }
    if (sessionId !== playerId) { res.status(403).json({ error: "You can only view your own unlocks" }); return; }

    const activeIds = await getActiveUnlockIds(playerId);
    res.json({ activeIds: Array.from(activeIds) });
  } catch (err) {
    logger.error({ err }, "Failed to get player self-play unlocks");
    res.status(500).json({ error: "Failed to get player self-play unlocks" });
  }
});

const PurchaseBody = z.object({ unlockId: z.string().min(1) });

// POST /api/players/:id/self-play-unlocks/purchase  { unlockId }
router.post("/players/:id/self-play-unlocks/purchase", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }

    const sessionId = sessionPlayerId(req);
    if (!sessionId) { res.status(401).json({ error: "Login required" }); return; }
    if (sessionId !== playerId) { res.status(403).json({ error: "You can only buy unlocks for your own account" }); return; }

    const parsed = PurchaseBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "unlockId is required" }); return; }
    const { unlockId } = parsed.data;

    const result = await db.transaction(async (tx) => {
      const [def] = await tx
        .select()
        .from(selfPlayUnlockDefinitionsTable)
        .where(and(eq(selfPlayUnlockDefinitionsTable.id, unlockId), eq(selfPlayUnlockDefinitionsTable.enabled, true)));
      if (!def) throw new Error("NOT_FOUND");

      // Permanent unlocks (personas, the drill bundle) can only be bought
      // once — the Preview Pass is the one exception, since re-buying it
      // is a legitimate way to extend access with a fresh window.
      if (def.category !== "PERSONA_PREVIEW_PASS") {
        const owned = await tx
          .select()
          .from(playerSelfPlayUnlocksTable)
          .where(and(eq(playerSelfPlayUnlocksTable.playerId, playerId), eq(playerSelfPlayUnlocksTable.unlockId, unlockId)));
        if (owned.length > 0) throw new Error("ALREADY_OWNED");
      }

      // FOR UPDATE locks the currency row for the rest of the transaction —
      // same guard as removeCoinsFromPlayer (card-shop-service.ts) and the
      // cosmetics purchase route: without it, two concurrent purchase
      // clicks could both read the same starting balance and both pass the
      // affordability check.
      const currency = await tx
        .select()
        .from(playerCurrencyTable)
        .where(eq(playerCurrencyTable.playerId, playerId))
        .for("update")
        .limit(1);
      const balance = currency[0]?.cardPoints ?? 0;
      if (!currency[0] || balance < def.price) throw new Error("INSUFFICIENT_COINS");

      const newBalance = balance - def.price;
      await tx
        .update(playerCurrencyTable)
        .set({ cardPoints: newBalance, updatedAt: new Date() })
        .where(eq(playerCurrencyTable.playerId, playerId));

      const expiresAt = def.durationDays
        ? new Date(Date.now() + def.durationDays * 24 * 60 * 60 * 1000)
        : null;
      await tx.insert(playerSelfPlayUnlocksTable).values({ playerId, unlockId, expiresAt });

      // Ledger entry inside the same transaction as the deduction above —
      // see lib/db/src/schema/player-currency.ts's currencyTransactionsTable.
      await tx.insert(currencyTransactionsTable).values({
        playerId, delta: -def.price, balanceAfter: newBalance,
        reason: "self_play_unlock", detail: def.name,
      });

      return { def, expiresAt };
    });

    res.json({ ok: true, unlock: result.def, expiresAt: result.expiresAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "NOT_FOUND")          { res.status(404).json({ error: "Unlock not found" }); return; }
    if (message === "ALREADY_OWNED")      { res.status(409).json({ error: "You already own this" }); return; }
    if (message === "INSUFFICIENT_COINS") { res.status(400).json({ error: "Not enough coins" }); return; }
    logger.error({ err }, "Failed to purchase self-play unlock");
    res.status(500).json({ error: "Failed to purchase self-play unlock" });
  }
});

export default router;
