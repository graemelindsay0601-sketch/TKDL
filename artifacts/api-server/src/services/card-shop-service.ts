import { db } from "@workspace/db";
import {
  cardInventoryTable,
  playerCurrencyTable,
  cardDefinitionsTable,
  cardPityTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const PACK_TYPES = {
  SINGLE: { coins: 50, cards: 1 },
  FIVE: { coins: 200, cards: 5 },
  TEN: { coins: 350, cards: 10 },
};

const RARITY_RATES = {
  COMMON: 0.75,
  RARE: 0.2,
  LEGENDARY: 0.05,
};

const PITY_THRESHOLD = 50; // Guaranteed legendary after 50 pulls without one

export async function purchasePack(playerId: number, packType: "SINGLE" | "FIVE" | "TEN") {
  const pack = PACK_TYPES[packType];
  if (!pack) throw new Error("Invalid pack type");

  // Check player currency
  const playerCurrency = await db
    .select()
    .from(playerCurrencyTable)
    .where(eq(playerCurrencyTable.playerId, playerId))
    .limit(1);

  if (!playerCurrency[0] || playerCurrency[0].coinBalance < pack.coins) {
    throw new Error("Insufficient coins");
  }

  // Deduct coins
  await db
    .update(playerCurrencyTable)
    .set({
      coinBalance: playerCurrency[0].coinBalance - pack.coins,
    })
    .where(eq(playerCurrencyTable.playerId, playerId));

  // Generate cards
  const cards = await generateCards(playerId, pack.cards);

  return {
    packType,
    costCoins: pack.coins,
    cardsGenerated: cards,
    timestamp: new Date(),
  };
}

async function generateCards(playerId: number, count: number) {
  const cards = [];
  let pityData = await db
    .select()
    .from(cardPityTable)
    .where(eq(cardPityTable.playerId, playerId))
    .limit(1);

  if (!pityData[0]) {
    await db.insert(cardPityTable).values({
      playerId,
      pullsSinceLegendary: 0,
    });
    pityData = await db
      .select()
      .from(cardPityTable)
      .where(eq(cardPityTable.playerId, playerId))
      .limit(1);
  }

  let pullsSinceLegendary = pityData[0].pullsSinceLegendary;

  for (let i = 0; i < count; i++) {
    let rarity: "COMMON" | "RARE" | "LEGENDARY";

    // Check if guaranteed legendary (pity)
    if (pullsSinceLegendary >= PITY_THRESHOLD) {
      rarity = "LEGENDARY";
      pullsSinceLegendary = 0;
    } else {
      // Weighted random
      const rand = Math.random();
      if (rand < RARITY_RATES.COMMON) {
        rarity = "COMMON";
      } else if (rand < RARITY_RATES.COMMON + RARITY_RATES.RARE) {
        rarity = "RARE";
      } else {
        rarity = "LEGENDARY";
        pullsSinceLegendary = 0;
      }

      if (rarity !== "LEGENDARY") {
        pullsSinceLegendary++;
      }
    }

    // Get random card of that rarity
    const cardPool = await db
      .select()
      .from(cardDefinitionsTable)
      .where(and(eq(cardDefinitionsTable.rarity, rarity), eq(cardDefinitionsTable.enabled, true)));

    if (cardPool.length === 0) {
      throw new Error(`No ${rarity} cards available`);
    }

    const randomCard = cardPool[Math.floor(Math.random() * cardPool.length)];

    // Add to inventory
    const existingCard = await db
      .select()
      .from(cardInventoryTable)
      .where(
        and(
          eq(cardInventoryTable.playerId, playerId),
          eq(cardInventoryTable.cardId, randomCard.cardId)
        )
      )
      .limit(1);

    if (existingCard[0]) {
      await db
        .update(cardInventoryTable)
        .set({ quantity: existingCard[0].quantity + 1 })
        .where(
          and(
            eq(cardInventoryTable.playerId, playerId),
            eq(cardInventoryTable.cardId, randomCard.cardId)
          )
        );
    } else {
      await db.insert(cardInventoryTable).values({
        playerId,
        cardId: randomCard.cardId,
        quantity: 1,
      });
    }

    cards.push({
      cardId: randomCard.cardId,
      name: randomCard.name,
      rarity,
      gameMode: randomCard.gameMode,
    });
  }

  // Update pity counter
  await db
    .update(cardPityTable)
    .set({ pullsSinceLegendary })
    .where(eq(cardPityTable.playerId, playerId));

  return cards;
}

export async function getPlayerInventory(playerId: number) {
  const inventory = await db
    .select({
      cardId: cardInventoryTable.cardId,
      quantity: cardInventoryTable.quantity,
      cardName: cardDefinitionsTable.name,
      rarity: cardDefinitionsTable.rarity,
      gameMode: cardDefinitionsTable.gameMode,
      cardType: cardDefinitionsTable.cardType,
      effect: cardDefinitionsTable.effect,
      imageUrl: cardDefinitionsTable.imageUrl,
    })
    .from(cardInventoryTable)
    .innerJoin(
      cardDefinitionsTable,
      eq(cardInventoryTable.cardId, cardDefinitionsTable.cardId)
    )
    .where(eq(cardInventoryTable.playerId, playerId));

  return inventory;
}

export async function getPlayerCurrency(playerId: number) {
  const currency = await db
    .select()
    .from(playerCurrencyTable)
    .where(eq(playerCurrencyTable.playerId, playerId))
    .limit(1);

  return currency[0] || { coinBalance: 0, lifetimeCoinsEarned: 0 };
}

export async function addCoinsToPlayer(playerId: number, amount: number) {
  const playerCurrency = await getPlayerCurrency(playerId);

  if (!playerCurrency.id) {
    await db.insert(playerCurrencyTable).values({
      playerId,
      coinBalance: amount,
      lifetimeCoinsEarned: amount,
    });
  } else {
    await db
      .update(playerCurrencyTable)
      .set({
        coinBalance: playerCurrency.coinBalance + amount,
        lifetimeCoinsEarned: playerCurrency.lifetimeCoinsEarned + amount,
      })
      .where(eq(playerCurrencyTable.playerId, playerId));
  }
}

export async function removeCoinsFromPlayer(playerId: number, amount: number) {
  const playerCurrency = await getPlayerCurrency(playerId);

  if (playerCurrency.coinBalance < amount) {
    throw new Error("Insufficient coins");
  }

  await db
    .update(playerCurrencyTable)
    .set({ coinBalance: playerCurrency.coinBalance - amount })
    .where(eq(playerCurrencyTable.playerId, playerId));
}

export async function giveCardToPlayer(playerId: number, cardId: string, quantity: number = 1) {
  const existingCard = await db
    .select()
    .from(cardInventoryTable)
    .where(
      and(eq(cardInventoryTable.playerId, playerId), eq(cardInventoryTable.cardId, cardId))
    )
    .limit(1);

  if (existingCard[0]) {
    await db
      .update(cardInventoryTable)
      .set({ quantity: existingCard[0].quantity + quantity })
      .where(
        and(eq(cardInventoryTable.playerId, playerId), eq(cardInventoryTable.cardId, cardId))
      );
  } else {
    await db.insert(cardInventoryTable).values({
      playerId,
      cardId,
      quantity,
    });
  }
}

export async function removeCardFromPlayer(playerId: number, cardId: string, quantity: number = 1) {
  const existingCard = await db
    .select()
    .from(cardInventoryTable)
    .where(
      and(eq(cardInventoryTable.playerId, playerId), eq(cardInventoryTable.cardId, cardId))
    )
    .limit(1);

  if (!existingCard[0]) {
    throw new Error("Card not found in inventory");
  }

  if (existingCard[0].quantity <= quantity) {
    await db
      .delete(cardInventoryTable)
      .where(
        and(eq(cardInventoryTable.playerId, playerId), eq(cardInventoryTable.cardId, cardId))
      );
  } else {
    await db
      .update(cardInventoryTable)
      .set({ quantity: existingCard[0].quantity - quantity })
      .where(
        and(eq(cardInventoryTable.playerId, playerId), eq(cardInventoryTable.cardId, cardId))
      );
  }
}

export async function getPlayerPityStatus(playerId: number) {
  const pity = await db
    .select()
    .from(cardPityTable)
    .where(eq(cardPityTable.playerId, playerId))
    .limit(1);

  return {
    pullsSinceLegendary: pity[0]?.pullsSinceLegendary || 0,
    pityThreshold: PITY_THRESHOLD,
    guaranteedNextPull: (pity[0]?.pullsSinceLegendary || 0) >= PITY_THRESHOLD,
  };
}

export async function resetPlayerCardData(playerId: number) {
  // Delete inventory
  await db.delete(cardInventoryTable).where(eq(cardInventoryTable.playerId, playerId));

  // Reset currency
  await db
    .update(playerCurrencyTable)
    .set({ coinBalance: 0 })
    .where(eq(playerCurrencyTable.playerId, playerId));

  // Reset pity
  await db
    .update(cardPityTable)
    .set({ pullsSinceLegendary: 0 })
    .where(eq(cardPityTable.playerId, playerId));
}
