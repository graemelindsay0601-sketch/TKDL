import { db } from "@workspace/db";
import {
  cardInventoryTable,
  playerCurrencyTable,
  cardDefinitionsTable,
  cardPityTable,
  currencyTransactionsTable,
  type CurrencyReason,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

// The callback passed to db.transaction() receives a PgTransaction, not the
// top-level `db` — it can run every query db can, but lacks db's `$client`
// (the raw pool), so `typeof db` alone is too narrow for a helper that gets
// called with either. Derive the transaction's own param type instead of
// hand-rolling one that could drift from whatever Drizzle actually passes in.
type DbOrTransaction = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

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

export async function purchasePack(
  playerId: number,
  packType: "SINGLE" | "FIVE" | "TEN",
  paymentMethod: "coins" | "packTokens" = "coins"
) {
  const pack = PACK_TYPES[packType];
  if (!pack) throw new Error("Invalid pack type");

  // Wrap currency deduction + card generation in a single transaction.
  // Previously these were separate, unguarded steps — if generateCards threw
  // partway through (e.g. "No {rarity} cards available", or any transient DB
  // error), the currency deduction above it had already committed, taking
  // the player's coins/tokens with fewer or no cards delivered in return.
  return await db.transaction(async (tx) => {
    // Check player currency. FOR UPDATE locks this row for the rest of the
    // transaction — without it, two concurrent purchases (e.g. double-tapping
    // "buy" or two browser tabs) could both read the same pre-purchase
    // balance under READ COMMITTED and both pass the affordability check,
    // letting a player spend the same coins twice.
    const playerCurrency = await tx
      .select()
      .from(playerCurrencyTable)
      .where(eq(playerCurrencyTable.playerId, playerId))
      .for("update")
      .limit(1);

    if (!playerCurrency[0]) {
      throw new Error("Player currency record not found");
    }

    // Validate payment method and deduct currency
    if (paymentMethod === "packTokens") {
      if ((playerCurrency[0].packTokens || 0) < 1) {
        throw new Error("Insufficient pack tokens");
      }
      // Deduct 1 pack token (regardless of pack size - tokens are all worth 1 pack)
      await tx
        .update(playerCurrencyTable)
        .set({
          packTokens: (playerCurrency[0].packTokens || 0) - 1,
          updatedAt: new Date(),
        })
        .where(eq(playerCurrencyTable.playerId, playerId));
    } else {
      // Use coins
      if ((playerCurrency[0].cardPoints || 0) < pack.coins) {
        throw new Error("Insufficient coins");
      }
      // Deduct coins
      const newBalance = (playerCurrency[0].cardPoints || 0) - pack.coins;
      await tx
        .update(playerCurrencyTable)
        .set({
          cardPoints: newBalance,
          updatedAt: new Date(),
        })
        .where(eq(playerCurrencyTable.playerId, playerId));
      // Ledger entry inside the same transaction as the deduction above —
      // see lib/db/src/schema/player-currency.ts's currencyTransactionsTable.
      // packTokens payments aren't logged here: that's a different, legacy
      // balance (see playerCurrencyTable.packTokens's own comment), not the
      // card_points balance this ledger tracks.
      await tx.insert(currencyTransactionsTable).values({
        playerId, delta: -pack.coins, balanceAfter: newBalance,
        reason: "card_pack_purchase", detail: packType,
      });
    }

    // Generate cards
    const cards = await generateCards(tx, playerId, pack.cards);

    return {
      packType,
      costCoins: paymentMethod === "coins" ? pack.coins : 0,
      costPackTokens: paymentMethod === "packTokens" ? 1 : 0,
      cardsGenerated: cards,
      timestamp: new Date(),
    };
  });
}

async function generateCards(tx: DbOrTransaction, playerId: number, count: number) {
  const cards = [];
  let pityData = await tx
    .select()
    .from(cardPityTable)
    .where(eq(cardPityTable.playerId, playerId))
    .limit(1);

  if (!pityData[0]) {
    await tx.insert(cardPityTable).values({
      playerId,
      pullsSinceLegendary: 0,
    });
    pityData = await tx
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
    const cardPool = await tx
      .select()
      .from(cardDefinitionsTable)
      .where(and(eq(cardDefinitionsTable.rarity, rarity), eq(cardDefinitionsTable.enabled, true)));

    if (cardPool.length === 0) {
      throw new Error(`No ${rarity} cards available`);
    }

    const randomCard = cardPool[Math.floor(Math.random() * cardPool.length)];

    // Add to inventory
    const existingCard = await tx
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
      await tx
        .update(cardInventoryTable)
        .set({ quantity: existingCard[0].quantity + 1 })
        .where(
          and(
            eq(cardInventoryTable.playerId, playerId),
            eq(cardInventoryTable.cardId, randomCard.cardId)
          )
        );
    } else {
      await tx.insert(cardInventoryTable).values({
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
  await tx
    .update(cardPityTable)
    .set({ pullsSinceLegendary })
    .where(eq(cardPityTable.playerId, playerId));

  return cards;
}

export async function getPlayerInventory(playerId: number) {
  const inventory = await db
    .select({
      id: cardDefinitionsTable.id,
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

  return currency[0] || { 
    id: undefined,
    playerId,
    cardPoints: 0, 
    packTokens: 0,
    lifetimeCoinsEarned: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function addCoinsToPlayer(
  playerId: number,
  amount: number,
  reason: CurrencyReason,
  detail?: string,
) {
  // Single atomic upsert instead of read-then-write: two concurrent awards to
  // the same player (e.g. a match-win coin grant firing alongside an
  // achievement grant) used to both read the same starting balance and one
  // credit could silently overwrite the other. onConflictDoUpdate with a SQL
  // increment expression makes the whole read-modify-write happen in one
  // statement, atomically, on the DB side. playerId has a unique constraint
  // so this always targets exactly one row. Wrapped in a transaction with the
  // ledger insert below so a credit and its history row are never split —
  // `reason` is now a required param specifically so every one of this
  // function's ~20 call sites across the app has to say why, at compile
  // time, rather than the Wallet's history having unexplained gaps.
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(playerCurrencyTable)
      .values({
        playerId,
        cardPoints: amount,
        lifetimeCoinsEarned: amount,
      })
      .onConflictDoUpdate({
        target: playerCurrencyTable.playerId,
        set: {
          cardPoints: sql`${playerCurrencyTable.cardPoints} + ${amount}`,
          lifetimeCoinsEarned: sql`${playerCurrencyTable.lifetimeCoinsEarned} + ${amount}`,
          updatedAt: new Date(),
        },
      })
      .returning({ cardPoints: playerCurrencyTable.cardPoints });

    await tx.insert(currencyTransactionsTable).values({
      playerId, delta: amount, balanceAfter: row.cardPoints, reason, detail: detail ?? null,
    });
  });
}

/**
 * Award coins to multiple players (e.g. a Card Clash match's winner + loser
 * payout) with one shared reason.
 *
 * This used to be its own hand-rolled batch of reads then writes — a real
 * lost-update race (the exact bug addCoinsToPlayer's own doc comment
 * describes) since it read every player's starting balance up front and
 * wrote back a computed total with no locking in between. It's a loop over
 * addCoinsToPlayer now instead: for the 2-player batches this is actually
 * called with (a match's winner + loser), the lost single-statement-batch
 * optimization is negligible next to getting the same atomic, ledger-logged
 * write as every other credit in the app, instead of a second bespoke path
 * that could drift from it.
 */
export async function awardCoinsToMultiplePlayers(
  playerCoins: Array<{ playerId: number; amount: number; detail?: string }>,
  reason: CurrencyReason,
): Promise<void> {
  for (const { playerId, amount, detail } of playerCoins) {
    await addCoinsToPlayer(playerId, amount, reason, detail);
  }
}

export async function awardPackTokens(playerId: number, amount: number) {
  const playerCurrency = await getPlayerCurrency(playerId);

  if (!playerCurrency.id) {
    await db.insert(playerCurrencyTable).values({
      playerId,
      packTokens: amount,
    });
  } else {
    await db
      .update(playerCurrencyTable)
      .set({
        packTokens: (playerCurrency.packTokens || 0) + amount,
        updatedAt: new Date(),
      })
      .where(eq(playerCurrencyTable.playerId, playerId));
  }
}

export async function removeCoinsFromPlayer(
  playerId: number,
  amount: number,
  reason: CurrencyReason,
  detail?: string,
) {
  // Row-locked + ledger-logged in one transaction now — this used to be a
  // plain read-then-write with no lock, the same race class addCoinsToPlayer
  // already guards against, just on the debit side.
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(playerCurrencyTable)
      .where(eq(playerCurrencyTable.playerId, playerId))
      .for("update");

    if (!row || (row.cardPoints || 0) < amount) {
      throw new Error("Insufficient coins");
    }

    const newBalance = (row.cardPoints || 0) - amount;
    await tx
      .update(playerCurrencyTable)
      .set({
        cardPoints: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(playerCurrencyTable.playerId, playerId));

    await tx.insert(currencyTransactionsTable).values({
      playerId, delta: -amount, balanceAfter: newBalance, reason, detail: detail ?? null,
    });
  });
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

// Pure inventory removal — despite the name, this used to ALSO silently pay
// the player 10 coins/card internally, baked in on the assumption every
// caller was a "sell" action. It wasn't: this is called for (1) an actual
// sell (routes/card-clash.ts's POST /sell-card, which already awards its
// own rarity-based coinsEarned right after calling this — that was a flat
// double-credit on every sale), (2) an admin manually removing a card to
// correct a mistake (routes/card-clash.ts's POST /admin/card/remove — an
// admin correction should never pay the player), and (3) a card actually
// being consumed by getting played in a Card Clash match
// (card-clash-service.ts's match-resolution step — this was quietly paying
// 10 free coins per card played, win or lose, on top of any real match
// reward, every single match). Removing the implicit credit here fixes all
// three at once: sell-card keeps its own explicit, correct award; the
// other two now correctly award nothing through this path.
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

  // Reset currency, logging the wipe as its own ledger entry (an absolute
  // set to 0 is really "debit whatever the balance was") so it isn't a
  // silent gap in the Wallet's history.
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(playerCurrencyTable)
      .where(eq(playerCurrencyTable.playerId, playerId))
      .for("update");
    const current = row?.cardPoints ?? 0;

    await tx
      .update(playerCurrencyTable)
      .set({ cardPoints: 0 })
      .where(eq(playerCurrencyTable.playerId, playerId));

    if (current > 0) {
      await tx.insert(currencyTransactionsTable).values({
        playerId, delta: -current, balanceAfter: 0, reason: "admin_reset",
      });
    }
  });

  // Reset pity
  await db
    .update(cardPityTable)
    .set({ pullsSinceLegendary: 0 })
    .where(eq(cardPityTable.playerId, playerId));
}
