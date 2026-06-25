import { db } from "@workspace/db";
import { cardDefinitionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ALL_CARDS } from "../seeds/all-cards";
import { logger } from "../lib/logger";

export async function seedCardDefinitions() {
  try {
    // Check if cards already exist
    const existingCards = await db.select().from(cardDefinitionsTable).limit(1);
    if (existingCards.length > 0) {
      logger.info("✓ Cards already seeded");
      return;
    }

    for (const card of ALL_CARDS) {
      // Convert component name to display format (camelCase → Title Case)
      const displayName = card.name
        .replace(/([A-Z])/g, " $1") // Add space before capitals
        .replace(/([0-9])/g, " $1") // Add space before numbers
        .trim()
        .replace(/\s+/g, " "); // Clean up multiple spaces

      await db.insert(cardDefinitionsTable).values({
        name: card.name,
        description: displayName,
        gameMode: card.gameMode.toUpperCase(),
        cardType: card.type,
        rarity: card.rarity,
        effect: card.effect,
        enabled: true,
      } as any);
    }

    logger.info(`✓ Seeded ${ALL_CARDS.length} unified cards`);
  } catch (error) {
    logger.error({ error }, "✗ Failed to seed cards");
  }
}

export async function getAllCardDefinitions() {
  return await db.select().from(cardDefinitionsTable).where(eq(cardDefinitionsTable.enabled, true));
}

export async function getCardsByGameMode(gameMode: "X01" | "CRICKET" | "WILDCARD") {
  return await db.select().from(cardDefinitionsTable).where(and(eq(cardDefinitionsTable.gameMode, gameMode), eq(cardDefinitionsTable.enabled, true)));
}

export async function getCardsByType(cardType: "GOOD" | "BAD") {
  return await db.select().from(cardDefinitionsTable).where(and(eq(cardDefinitionsTable.cardType, cardType), eq(cardDefinitionsTable.enabled, true)));
}

export async function getCardById(cardId: string) {
  return await db.select().from(cardDefinitionsTable).where(eq(cardDefinitionsTable.name, cardId)).limit(1);
}

export async function toggleCardAvailability(cardId: string, enabled: boolean) {
  await db.update(cardDefinitionsTable).set({ enabled }).where(eq(cardDefinitionsTable.name, cardId));
}
