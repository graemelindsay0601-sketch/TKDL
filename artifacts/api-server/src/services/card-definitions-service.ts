import { db } from "@workspace/db";
import { cardDefinitionsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { ALL_CARDS } from "../seeds/all-cards";
import { logger } from "../lib/logger";

const EXPECTED_COUNT  = 100;
const SENTINEL_NAME   = "Big Game Player"; // first card in spec — proves seed is current

export async function seedCardDefinitions() {
  try {
    // Check whether the current seed is already in place
    const [{ value: existingCount }] = await db.select({ value: count() }).from(cardDefinitionsTable);
    if (Number(existingCount) === EXPECTED_COUNT) {
      const sentinel = await db.select().from(cardDefinitionsTable).where(eq(cardDefinitionsTable.name, SENTINEL_NAME)).limit(1);
      if (sentinel.length > 0) {
        logger.info("Cards already seeded with current spec — skipping");
        return;
      }
    }

    // Delete stale cards and re-seed
    logger.info({ existingCount }, "Re-seeding card definitions (old seed detected)");
    await db.delete(cardDefinitionsTable);

    for (const card of ALL_CARDS) {
      await db.insert(cardDefinitionsTable).values({
        name:        card.name,
        description: card.effect,
        gameMode:    card.gameMode,
        cardType:    card.type,
        rarity:      card.rarity,
        effect:      card.effect,
        enabled:     true,
      } as any);
    }

    logger.info(`Seeded ${ALL_CARDS.length} card definitions`);
  } catch (error) {
    logger.error({ error }, "Failed to seed cards");
  }
}

export async function getAllCardDefinitions() {
  return await db.select().from(cardDefinitionsTable).where(eq(cardDefinitionsTable.enabled, true));
}

export async function getCardsByGameMode(gameMode: "X01" | "CRICKET" | "WILDCARD") {
  return await db.select().from(cardDefinitionsTable).where(
    and(eq(cardDefinitionsTable.gameMode, gameMode), eq(cardDefinitionsTable.enabled, true))
  );
}

export async function getCardsByType(cardType: "GOOD" | "BAD") {
  return await db.select().from(cardDefinitionsTable).where(
    and(eq(cardDefinitionsTable.cardType, cardType), eq(cardDefinitionsTable.enabled, true))
  );
}

export async function getCardById(cardId: string) {
  return await db.select().from(cardDefinitionsTable).where(eq(cardDefinitionsTable.name, cardId)).limit(1);
}

export async function toggleCardAvailability(cardId: string, enabled: boolean) {
  await db.update(cardDefinitionsTable).set({ enabled }).where(eq(cardDefinitionsTable.name, cardId));
}
