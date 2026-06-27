import { db } from "@workspace/db";
import {
  featuredCardShopTable,
  shopPurchaseHistoryTable,
  cardDefinitionsTable,
  playerCurrencyTable,
  cardInventoryTable,
} from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "../logger";

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
 * Get today's featured cards
 */
export async function getTodaysFeaturedCards() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const featured = await db
    .select({
      id: featuredCardShopTable.id,
      cardId: featuredCardShopTable.cardId,
      slotNumber: featuredCardShopTable.slotNumber,
      priceCoins: featuredCardShopTable.priceCoins,
      card: {
        id: cardDefinitionsTable.id,
        name: cardDefinitionsTable.name,
        rarity: cardDefinitionsTable.rarity,
        icon: cardDefinitionsTable.icon,
        category: cardDefinitionsTable.category,
      },
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

  return featured;
}

/**
 * Rotate featured cards daily
 * Called once per day to generate new featured cards
 */
export async function rotateFeatureCards() {
  try {
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

    // Get all cards from Card Clash
    const allCards = await db
      .select()
      .from(cardDefinitionsTable)
      .where(eq(cardDefinitionsTable.gameMode, "Card Clash"));

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

    // Deduct coins
    await db
      .update(playerCurrencyTable)
      .set({
        cardPoints: (playerCurrency.cardPoints || 0) - featured.priceCoins,
        updatedAt: new Date(),
      })
      .where(eq(playerCurrencyTable.playerId, playerId));

    // Give card to player
    await db.insert(cardInventoryTable).values({
      playerId,
      cardId,
    });

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
