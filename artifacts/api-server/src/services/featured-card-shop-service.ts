import { db } from "@workspace/db";
import {
  featuredCardShopTable,
  shopPurchaseHistoryTable,
  cardDefinitionsTable,
  playerCurrencyTable,
} from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { giveCardToPlayer } from "./card-shop-service";

/**
 * Rarity-based pricing for featured shop
 * Premium over pack costs (SINGLE pack = 50 coins)
 */
const SHOP_PRICING = {
  COMMON: 40,      // Slightly cheaper than pack
  RARE: 75,        // Premium over SINGLE pack
  LEGENDARY: 200,  // Significant premium
};

/**
 * Ensure the featured shop tables exist. These tables were never wired into
 * any startup migration, so on a fresh database (e.g. the live deployment)
 * they simply didn't exist — every query below would silently throw and get
 * swallowed by the non-critical startup try/catch, making the Featured Shop
 * appear "broken" with no visible error. This is idempotent and cheap, so we
 * call it defensively from every entry point in this file.
 */
let tablesEnsured = false;
async function ensureFeaturedShopTables() {
  if (tablesEnsured) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS featured_card_shop (
      id SERIAL PRIMARY KEY,
      card_id INTEGER NOT NULL REFERENCES card_definitions(id),
      slot_number INTEGER NOT NULL,
      price_coins INTEGER NOT NULL,
      rotation_date TIMESTAMP WITH TIME ZONE NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_featured_card_shop_rotation_date
    ON featured_card_shop(rotation_date)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_featured_card_shop_is_active
    ON featured_card_shop(is_active)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS shop_purchase_history (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id),
      card_id INTEGER NOT NULL REFERENCES card_definitions(id),
      slot_number INTEGER NOT NULL,
      price_coins INTEGER NOT NULL,
      purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_shop_purchase_history_player_id
    ON shop_purchase_history(player_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_shop_purchase_history_purchased_at
    ON shop_purchase_history(purchased_at)
  `);

  tablesEnsured = true;
}

/**
 * Get today's featured cards
 */
export async function getTodaysFeaturedCards() {
  await ensureFeaturedShopTables();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const query = () =>
    db
      .select({
        id: featuredCardShopTable.id,
        cardId: featuredCardShopTable.cardId,
        slotNumber: featuredCardShopTable.slotNumber,
        priceCoins: featuredCardShopTable.priceCoins,
        cardName: cardDefinitionsTable.name,
        rarity: cardDefinitionsTable.rarity,
        gameMode: cardDefinitionsTable.gameMode,
        imageUrl: cardDefinitionsTable.imageUrl,
      })
      .from(featuredCardShopTable)
      .leftJoin(
        cardDefinitionsTable,
        eq(featuredCardShopTable.cardId, cardDefinitionsTable.id)
      )
      .where(
        and(
          gte(featuredCardShopTable.rotationDate, today),
          eq(featuredCardShopTable.isActive, true)
        )
      )
      .orderBy(featuredCardShopTable.slotNumber);

  let featured = await query();

  // Self-heal: rotateFeatureCards() is normally only triggered at server
  // startup or via an admin action, so on a long-running deployment that
  // hasn't restarted since a previous calendar day, no row will ever match
  // "today" and the shop appears permanently empty. Rather than depending on
  // restart timing (or a cron job that may not fire), detect the staleness
  // here and rotate on demand so the shop is always populated for "today".
  if (featured.length === 0) {
    try {
      await rotateFeatureCards();
      featured = await query();
    } catch (error) {
      logger.error({ error }, "Self-heal rotation failed in getTodaysFeaturedCards");
    }
  }

  return featured;
}

/**
 * Rotate featured cards daily
 * Called once per day to generate new featured cards
 */
export async function rotateFeatureCards() {
  try {
    await ensureFeaturedShopTables();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if rotation already happened today
    const existingRotation = await db
      .select()
      .from(featuredCardShopTable)
      .where(gte(featuredCardShopTable.rotationDate, today))
      .limit(1);

    if (existingRotation.length > 0) {
      logger.info("Featured cards already rotated today");
      return existingRotation;
    }

    // Mark old cards as inactive
    await db
      .update(featuredCardShopTable)
      .set({ isActive: false })
      .where(eq(featuredCardShopTable.isActive, true));

    // Get all cards (all 100 cards are Card Clash cards: X01, Cricket, Wildcard)
    const allCards = await db
      .select()
      .from(cardDefinitionsTable);

    if (allCards.length === 0) {
      throw new Error("No Card Clash cards found");
    }

    // Select 3 cards: 1 Common, 1 Rare, 1 Legendary (with fallback randomization)
    const commonCards = allCards.filter((c) => c.rarity === "COMMON");
    const rareCards = allCards.filter((c) => c.rarity === "RARE");
    const legendaryCards = allCards.filter((c) => c.rarity === "LEGENDARY");

    const selected = [];

    // Slot 1: Common
    if (commonCards.length > 0) {
      const card = commonCards[Math.floor(Math.random() * commonCards.length)];
      selected.push({ card, slot: 1, rarity: "COMMON" });
    }

    // Slot 2: Rare
    if (rareCards.length > 0) {
      const card = rareCards[Math.floor(Math.random() * rareCards.length)];
      selected.push({ card, slot: 2, rarity: "RARE" });
    }

    // Slot 3: Legendary
    if (legendaryCards.length > 0) {
      const card = legendaryCards[Math.floor(Math.random() * legendaryCards.length)];
      selected.push({ card, slot: 3, rarity: "LEGENDARY" });
    }

    // Insert new featured cards
    const newFeatured = selected.map(({ card, slot, rarity }) => ({
      cardId: card.id,
      slotNumber: slot,
      priceCoins: SHOP_PRICING[rarity as keyof typeof SHOP_PRICING],
      rotationDate: today,
      isActive: true,
    }));

    const result = await db.insert(featuredCardShopTable).values(newFeatured);

    logger.info(
      { selectedCards: newFeatured.length },
      "Featured cards rotated successfully"
    );

    return newFeatured;
  } catch (error) {
    logger.error({ error }, "Failed to rotate featured cards");
    throw error;
  }
}

/**
 * Purchase a featured card
 */
export async function purchaseFeaturedCard(
  playerId: number,
  cardId: number
): Promise<{
  success: boolean;
  message: string;
  cardName?: string;
  coinsSpent?: number;
}> {
  try {
    await ensureFeaturedShopTables();

    // Get the featured card
    const [featured] = await db
      .select()
      .from(featuredCardShopTable)
      .where(
        and(
          eq(featuredCardShopTable.cardId, cardId),
          eq(featuredCardShopTable.isActive, true)
        )
      );

    if (!featured) {
      return { success: false, message: "Card not currently featured" };
    }

    // Check purchase cooldown (24-hour per card)
    const { checkCardPurchaseCooldown } = await import("./shop-purchase-cooldown-service");
    const cooldown = await checkCardPurchaseCooldown(playerId, cardId);
    if (!cooldown.canPurchase) {
      return {
        success: false,
        message: `Card on cooldown. Available in ${cooldown.hoursUntilAvailable} hours`,
      };
    }

    // Get player currency
    const [playerCurrency] = await db
      .select()
      .from(playerCurrencyTable)
      .where(eq(playerCurrencyTable.playerId, playerId));

    if (!playerCurrency) {
      return { success: false, message: "Player currency not found" };
    }

    // Check if player has enough coins
    if ((playerCurrency.cardPoints || 0) < featured.priceCoins) {
      return {
        success: false,
        message: `Insufficient coins. Need ${featured.priceCoins}, have ${playerCurrency.cardPoints}`,
      };
    }

    // Get card details
    const [card] = await db
      .select()
      .from(cardDefinitionsTable)
      .where(eq(cardDefinitionsTable.id, cardId));

    if (!card) {
      return { success: false, message: "Card definition not found" };
    }

    // Deduct coins
    await db
      .update(playerCurrencyTable)
      .set({
        cardPoints: (playerCurrency.cardPoints || 0) - featured.priceCoins,
        updatedAt: new Date(),
      })
      .where(eq(playerCurrencyTable.playerId, playerId));

    // Give card to player. Note: player_card_inventory keys cards by their
    // UUID `cardDefinitionsTable.cardId`, NOT the integer `cardDefinitionsTable.id`
    // used by the featured shop's own foreign key. Inserting the raw integer
    // `cardId` param here (as the old code did) wrote the wrong value into a
    // UUID column and would fail/corrupt inventory. Route through the shared
    // helper so quantity-stacking behaves the same as every other card-grant path.
    await giveCardToPlayer(playerId, card.cardId, 1);

    // Record purchase in history (for auditing)
    await db.insert(shopPurchaseHistoryTable).values({
      playerId,
      cardId,
      slotNumber: featured.slotNumber,
      priceCoins: featured.priceCoins,
    });

    logger.info(
      { playerId, cardId, cardName: card?.name, coinsSpent: featured.priceCoins },
      "Featured card purchased"
    );

    return {
      success: true,
      message: `Purchased ${card?.name} for ${featured.priceCoins} coins`,
      cardName: card?.name,
      coinsSpent: featured.priceCoins,
    };
  } catch (error) {
    logger.error({ playerId, cardId, error }, "Failed to purchase featured card");
    return { success: false, message: "Purchase failed. Please try again." };
  }
}

/**
 * Get shop purchase history for auditing
 */
export async function getShopPurchaseHistory(limit: number = 100) {
  await ensureFeaturedShopTables();

  return await db
    .select({
      playerId: shopPurchaseHistoryTable.playerId,
      cardId: shopPurchaseHistoryTable.cardId,
      cardName: cardDefinitionsTable.name,
      cardRarity: cardDefinitionsTable.rarity,
      priceCoins: shopPurchaseHistoryTable.priceCoins,
      purchasedAt: shopPurchaseHistoryTable.purchasedAt,
    })
    .from(shopPurchaseHistoryTable)
    .leftJoin(
      cardDefinitionsTable,
      eq(shopPurchaseHistoryTable.cardId, cardDefinitionsTable.id)
    )
    .orderBy(sql`${shopPurchaseHistoryTable.purchasedAt} DESC`)
    .limit(limit);
}

/**
 * Get shop statistics for auditing
 */
export async function getShopStatistics() {
  await ensureFeaturedShopTables();

  const totalPurchases = await db
    .select({ count: sql`COUNT(*)` })
    .from(shopPurchaseHistoryTable);

  const coinsSpent = await db
    .select({ total: sql`SUM(${shopPurchaseHistoryTable.priceCoins})` })
    .from(shopPurchaseHistoryTable);

  const cardDistribution = await db
    .select({
      rarity: cardDefinitionsTable.rarity,
      count: sql`COUNT(*)`,
    })
    .from(shopPurchaseHistoryTable)
    .leftJoin(
      cardDefinitionsTable,
      eq(shopPurchaseHistoryTable.cardId, cardDefinitionsTable.id)
    )
    .groupBy(cardDefinitionsTable.rarity);

  return {
    totalPurchases: totalPurchases[0]?.count || 0,
    totalCoinsSpent: coinsSpent[0]?.total || 0,
    purchasesByRarity: cardDistribution,
  };
}
