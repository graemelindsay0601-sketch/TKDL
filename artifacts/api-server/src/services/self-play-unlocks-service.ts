import { db } from "@workspace/db";
import { selfPlayUnlockDefinitionsTable, playerSelfPlayUnlocksTable, type SelfPlayUnlockCategory } from "@workspace/db";
import { and, eq, or, isNull, gt } from "drizzle-orm";
import { logger } from "../lib/logger";

interface SeedUnlock {
  id: string;
  category: SelfPlayUnlockCategory;
  name: string;
  description: string;
  price: number;
  durationDays?: number;
  sortOrder: number;
}

// Two Elite-tier "Play a Pro" personas, locked behind a purchase — see
// bot-engine.ts's BOT_PERSONAS for the full roster (every other persona,
// Elite tier included, stays free/open exactly as it is today). Picked
// these two specifically because they're the two toughest personas in the
// app (109 and 107 avg, the top of the whole roster) — locking the very
// best opponents behind a purchase is the usual shape for this kind of
// unlock, and it leaves two Elite personas (Mikkel van Garwin, Bill
// Tailor) still free so "Play a Pro" isn't gutted for anyone who doesn't
// spend. Priced above a ten-card-pack (350) territory but each still
// cheaper than a Legendary cosmetic (1000) — a real but not extortionate
// ask for a permanent, repeatable-use unlock.
const SHADOW_PERSONAS: SeedUnlock[] = [
  {
    id: "persona-luke_harbours", category: "SHADOW_PERSONA",
    name: "Luke Harbours", description: "Unlock the World No.1 as a permanent Play a Pro opponent — 109 avg, clinical and unstoppable.",
    price: 300, sortOrder: 0,
  },
  {
    id: "persona-luca_scrawler", category: "SHADOW_PERSONA",
    name: "Luca Scrawler", description: "Unlock The Nuke as a permanent Play a Pro opponent — 107 avg, already terrifying.",
    price: 275, sortOrder: 1,
  },
];

// One catalog row. Repurposes what was originally scoped as "early
// bot-difficulty access" — see self-play-unlocks.ts's header comment for
// why the literal request didn't hold up. Cheaper than buying both
// personas above permanently (575 combined), reflecting that it's a
// worse deal long-term (it expires) in exchange for a much lower price to
// try them.
const PREVIEW_PASS: SeedUnlock = {
  id: "persona-preview-pass", category: "PERSONA_PREVIEW_PASS",
  name: "Persona Preview Pass", description: "7-day access to every currently-locked Play a Pro persona at once — no commitment, just a taste of the toughest opponents in the roster.",
  price: 120, durationDays: 7, sortOrder: 10,
};

// One bundle purchase unlocking both bonus Coach's Corner drills together
// (see generatePracticeRoutine() in routes/practice.ts) rather than
// per-drill pricing — there are only ever a couple of bonus drills, so
// splitting them into separate purchases added friction with no real
// upside.
const COACH_BONUS: SeedUnlock = {
  id: "coach-bonus-pack", category: "COACH_DRILL",
  name: "Coach's Corner Bonus Pack", description: "Unlocks two advanced training blocks in your Coach's Corner routine, on top of the ones your bot already builds for free from your stats.",
  price: 200, sortOrder: 20,
};

export const ALL_SELF_PLAY_UNLOCKS: SeedUnlock[] = [...SHADOW_PERSONAS, PREVIEW_PASS, COACH_BONUS];

export async function seedSelfPlayUnlockDefinitions(): Promise<void> {
  for (const u of ALL_SELF_PLAY_UNLOCKS) {
    try {
      await db
        .insert(selfPlayUnlockDefinitionsTable)
        .values({
          id: u.id, category: u.category, name: u.name, description: u.description,
          price: u.price, enabled: true, durationDays: u.durationDays ?? null, sortOrder: u.sortOrder,
        })
        .onConflictDoUpdate({
          target: selfPlayUnlockDefinitionsTable.id,
          set: {
            category: u.category, name: u.name, description: u.description,
            price: u.price, durationDays: u.durationDays ?? null, sortOrder: u.sortOrder,
          },
        });
    } catch (err) {
      logger.error({ err, unlockId: u.id }, "Failed to seed self-play unlock definition");
    }
  }
}

/**
 * A player's currently-ACTIVE unlock ids — expired Preview Pass rows are
 * excluded, everything else (permanent rows, expiresAt IS NULL) always
 * counts. Shared by the purchase route's "already owned" checks and by
 * GET /self-play-unlocks/:playerId's ownership response, so the two can
 * never disagree about what "unlocked" means.
 */
export async function getActiveUnlockIds(playerId: number): Promise<Set<string>> {
  const rows = await db
    .select({ unlockId: playerSelfPlayUnlocksTable.unlockId })
    .from(playerSelfPlayUnlocksTable)
    .where(and(
      eq(playerSelfPlayUnlocksTable.playerId, playerId),
      or(isNull(playerSelfPlayUnlocksTable.expiresAt), gt(playerSelfPlayUnlocksTable.expiresAt, new Date())),
    ));
  return new Set(rows.map(r => r.unlockId));
}
