import { Router } from "express";
import { db, playersTable, playerCurrencyTable, cosmeticDefinitionsTable, playerCosmeticsTable, currencyTransactionsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";

const router = Router();

// Same shape as the session-playerId helper this session already added to
// broadcast.ts and used inline in stats-detailed.ts's drill-complete route
// — req.session.playerId is usersTable.playerId, the players.id FK set at
// login, which is exactly what every route below needs to check "is this
// the player's own account".
function sessionPlayerId(req: any): number | null {
  return (req.session as any)?.playerId ?? null;
}

// GET /api/cosmetics/catalog — the full enabled shop catalog. No auth
// needed: the shop UI reads this to render what's for sale, and anyone
// rendering another player's equipped cosmetic (e.g. player-detail) needs
// to look its colour/gradient/icon up here too.
router.get("/cosmetics/catalog", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(cosmeticDefinitionsTable)
      .where(eq(cosmeticDefinitionsTable.enabled, true))
      .orderBy(asc(cosmeticDefinitionsTable.category), asc(cosmeticDefinitionsTable.sortOrder));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to get cosmetics catalog");
    res.status(500).json({ error: "Failed to get cosmetics catalog" });
  }
});

// GET /api/players/:id/cosmetics — this player's owned cosmetic ids and
// what's currently equipped in each slot. Public (same reasoning as the
// catalog above — player-detail needs this for whoever it's showing).
router.get("/players/:id/cosmetics", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }

    const [player] = await db
      .select({
        equippedNameStyleId: playersTable.equippedNameStyleId,
        equippedProfileIconId: playersTable.equippedProfileIconId,
        equippedBannerId: playersTable.equippedBannerId,
        equippedFrameId: playersTable.equippedFrameId,
        equippedGlowId: playersTable.equippedGlowId,
        equippedResultThemeId: playersTable.equippedResultThemeId,
        equippedBubbleColorId: playersTable.equippedBubbleColorId,
        equippedAvatarBadgeId: playersTable.equippedAvatarBadgeId,
        equippedLeaderboardTagId: playersTable.equippedLeaderboardTagId,
        equippedTaglineStyleId: playersTable.equippedTaglineStyleId,
        equippedPostAccentId: playersTable.equippedPostAccentId,
        equippedCheckoutEffectId: playersTable.equippedCheckoutEffectId,
        equippedScorerThemeId: playersTable.equippedScorerThemeId,
        equippedPlayerCardFinishId: playersTable.equippedPlayerCardFinishId,
        equippedTrophyCaseStyleId: playersTable.equippedTrophyCaseStyleId,
        equippedRecapStyleId: playersTable.equippedRecapStyleId,
      })
      .from(playersTable)
      .where(eq(playersTable.id, playerId));
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }

    const owned = await db
      .select({ cosmeticId: playerCosmeticsTable.cosmeticId })
      .from(playerCosmeticsTable)
      .where(eq(playerCosmeticsTable.playerId, playerId));

    res.json({
      ownedIds: owned.map(o => o.cosmeticId),
      equippedNameStyleId: player.equippedNameStyleId,
      equippedProfileIconId: player.equippedProfileIconId,
      equippedBannerId: player.equippedBannerId,
      equippedFrameId: player.equippedFrameId,
      equippedGlowId: player.equippedGlowId,
      equippedResultThemeId: player.equippedResultThemeId,
      equippedBubbleColorId: player.equippedBubbleColorId,
      equippedAvatarBadgeId: player.equippedAvatarBadgeId,
      equippedLeaderboardTagId: player.equippedLeaderboardTagId,
      equippedTaglineStyleId: player.equippedTaglineStyleId,
      equippedPostAccentId: player.equippedPostAccentId,
      equippedCheckoutEffectId: player.equippedCheckoutEffectId,
      equippedScorerThemeId: player.equippedScorerThemeId,
      equippedPlayerCardFinishId: player.equippedPlayerCardFinishId,
      equippedTrophyCaseStyleId: player.equippedTrophyCaseStyleId,
      equippedRecapStyleId: player.equippedRecapStyleId,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get player cosmetics");
    res.status(500).json({ error: "Failed to get player cosmetics" });
  }
});

const PurchaseBody = z.object({ cosmeticId: z.string().min(1) });

// POST /api/players/:id/cosmetics/purchase  { cosmeticId }
router.post("/players/:id/cosmetics/purchase", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }

    const sessionId = sessionPlayerId(req);
    if (!sessionId) { res.status(401).json({ error: "Login required" }); return; }
    if (sessionId !== playerId) { res.status(403).json({ error: "You can only buy cosmetics for your own account" }); return; }

    const parsed = PurchaseBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "cosmeticId is required" }); return; }
    const { cosmeticId } = parsed.data;

    const cosmetic = await db.transaction(async (tx) => {
      const [def] = await tx
        .select()
        .from(cosmeticDefinitionsTable)
        .where(and(eq(cosmeticDefinitionsTable.id, cosmeticId), eq(cosmeticDefinitionsTable.enabled, true)));
      if (!def) throw new Error("NOT_FOUND");
      // Season-champion-exclusive style cosmetics (purchasable=false) are
      // only ever granted by server-side code — this is defense in depth
      // behind the shop UI already hiding their Buy button (see
      // schema/cosmetics.ts's header comment on `purchasable`).
      if (!def.purchasable) throw new Error("NOT_PURCHASABLE");

      const already = await tx
        .select()
        .from(playerCosmeticsTable)
        .where(and(eq(playerCosmeticsTable.playerId, playerId), eq(playerCosmeticsTable.cosmeticId, cosmeticId)));
      if (already.length > 0) throw new Error("ALREADY_OWNED");

      // FOR UPDATE locks the currency row for the rest of the transaction —
      // same guard as purchasePack in card-shop-service.ts, for the same
      // reason: without it, two concurrent purchase clicks could both read
      // the same starting balance and both pass the affordability check.
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

      await tx.insert(playerCosmeticsTable).values({ playerId, cosmeticId });

      // Ledger entry inside the same transaction as the deduction above —
      // see lib/db/src/schema/player-currency.ts's currencyTransactionsTable.
      await tx.insert(currencyTransactionsTable).values({
        playerId, delta: -def.price, balanceAfter: newBalance,
        reason: "cosmetic_purchase", detail: def.name,
      });

      return def;
    });

    res.json({ ok: true, cosmetic });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "NOT_FOUND")          { res.status(404).json({ error: "Cosmetic not found" }); return; }
    if (message === "NOT_PURCHASABLE")    { res.status(403).json({ error: "This cosmetic can't be bought — it's awarded automatically" }); return; }
    if (message === "ALREADY_OWNED")      { res.status(409).json({ error: "You already own this cosmetic" }); return; }
    if (message === "INSUFFICIENT_COINS") { res.status(400).json({ error: "Not enough coins" }); return; }
    logger.error({ err }, "Failed to purchase cosmetic");
    res.status(500).json({ error: "Failed to purchase cosmetic" });
  }
});

// STICKER is deliberately excluded here — it's never equipped to a slot,
// only owned and then attached per-message (see POST /messages below).
const EquipBody = z.object({
  category: z.enum(["NAME_STYLE", "PROFILE_ICON", "BANNER", "FRAME", "GLOW", "RESULT_THEME", "BUBBLE_COLOR", "AVATAR_BADGE", "LEADERBOARD_TAG", "TAGLINE_STYLE", "POST_ACCENT", "CHECKOUT_EFFECT", "SCORER_THEME", "PLAYER_CARD_FINISH", "TROPHY_CASE_STYLE", "RECAP_STYLE"]),
  cosmeticId: z.string().min(1).nullable(),
});

// POST /api/players/:id/cosmetics/equip  { category, cosmeticId | null }
router.post("/players/:id/cosmetics/equip", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }

    const sessionId = sessionPlayerId(req);
    if (!sessionId) { res.status(401).json({ error: "Login required" }); return; }
    if (sessionId !== playerId) { res.status(403).json({ error: "You can only equip cosmetics for your own account" }); return; }

    const parsed = EquipBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "category and cosmeticId are required" }); return; }
    const { category, cosmeticId } = parsed.data;

    if (cosmeticId !== null) {
      const [def] = await db.select().from(cosmeticDefinitionsTable).where(eq(cosmeticDefinitionsTable.id, cosmeticId));
      if (!def || def.category !== category) {
        res.status(400).json({ error: "Cosmetic does not exist or is the wrong category" }); return;
      }
      const owned = await db
        .select()
        .from(playerCosmeticsTable)
        .where(and(eq(playerCosmeticsTable.playerId, playerId), eq(playerCosmeticsTable.cosmeticId, cosmeticId)));
      if (owned.length === 0) { res.status(403).json({ error: "You don't own this cosmetic" }); return; }
    }

    // Explicit branches rather than a computed key — keeps this fully
    // type-checked against playersTable's real columns.
    let updateData: Partial<typeof playersTable.$inferInsert>;
    if (category === "NAME_STYLE") updateData = { equippedNameStyleId: cosmeticId };
    else if (category === "PROFILE_ICON") updateData = { equippedProfileIconId: cosmeticId };
    else if (category === "BANNER") updateData = { equippedBannerId: cosmeticId };
    else if (category === "FRAME") updateData = { equippedFrameId: cosmeticId };
    else if (category === "GLOW") updateData = { equippedGlowId: cosmeticId };
    else if (category === "RESULT_THEME") updateData = { equippedResultThemeId: cosmeticId };
    else if (category === "BUBBLE_COLOR") updateData = { equippedBubbleColorId: cosmeticId };
    else if (category === "AVATAR_BADGE") updateData = { equippedAvatarBadgeId: cosmeticId };
    else if (category === "LEADERBOARD_TAG") updateData = { equippedLeaderboardTagId: cosmeticId };
    else if (category === "TAGLINE_STYLE") updateData = { equippedTaglineStyleId: cosmeticId };
    else if (category === "POST_ACCENT") updateData = { equippedPostAccentId: cosmeticId };
    else if (category === "CHECKOUT_EFFECT") updateData = { equippedCheckoutEffectId: cosmeticId };
    else if (category === "SCORER_THEME") updateData = { equippedScorerThemeId: cosmeticId };
    else if (category === "PLAYER_CARD_FINISH") updateData = { equippedPlayerCardFinishId: cosmeticId };
    else if (category === "TROPHY_CASE_STYLE") updateData = { equippedTrophyCaseStyleId: cosmeticId };
    else updateData = { equippedRecapStyleId: cosmeticId };

    await db
      .update(playersTable)
      .set(updateData)
      .where(eq(playersTable.id, playerId));

    res.json({ ok: true, category, cosmeticId });
  } catch (err) {
    logger.error({ err }, "Failed to equip cosmetic");
    res.status(500).json({ error: "Failed to equip cosmetic" });
  }
});

export default router;
