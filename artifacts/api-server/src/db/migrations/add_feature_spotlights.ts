import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Migration: broadcast_feature_spotlights — the FILLER family's
 * FEATURE_SPOTLIGHT registry (see lib/db/src/schema/broadcast.ts's own
 * 13.5 comment and story-detectors-filler.ts's header). Idempotent CREATE
 * TABLE IF NOT EXISTS, same convention as add_tkdl_live_broadcast.ts.
 *
 * Also seeds a small, curated list of real, already-shipped modes (each
 * key verified against artifacts/tkdl/src/App.tsx's own route list at the
 * time this migration was written) via individual parameterized
 * INSERT ... ON CONFLICT DO NOTHING statements — without this, the
 * registry ships empty and FEATURE_SPOTLIGHT stays permanently silent
 * until someone with direct database access populates it by hand, which
 * defeats the point of wiring the detector in at all. An admin can later
 * disable any row (or add more) without this migration ever touching
 * those rows again — ON CONFLICT DO NOTHING only ever fills in what's
 * missing, never overwrites a row that already exists.
 */
export async function addFeatureSpotlights() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS broadcast_feature_spotlights (
        id SERIAL PRIMARY KEY,
        feature_key TEXT UNIQUE NOT NULL,
        feature_name TEXT NOT NULL,
        blurb TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const seedRows: { key: string; name: string; blurb: string }[] = [
      { key: "card_clash", name: "Card Clash", blurb: "Collect player cards and battle them head to head from the main menu." },
      { key: "boss_battle", name: "Boss Battle", blurb: "A scaling checkout challenge you can take on solo or with mates." },
      { key: "board_curse", name: "Board Curse", blurb: "A curveball ruleset that flips your usual scoring, good for a laugh on a practice night." },
      { key: "master501", name: "Master 501", blurb: "A structured 501 training mode built for sharpening your finishing." },
      { key: "tour", name: "TKDL Tour", blurb: "A multi stop knockout tournament mode you can run outside the regular league." },
      { key: "hall_of_fame", name: "Hall of Fame", blurb: "All time records and milestone holders across every league in one place." },
      { key: "shadow_league", name: "Shadow League", blurb: "A simulated league table built entirely from Shadow Bot results." },
      { key: "practice_games", name: "Practice Games", blurb: "More than sixty darts games are available in Practice, with solo, local and bot options." },
      { key: "bot_opponents", name: "Bot Opponents", blurb: "Play a quick match against a bot at a level that suits you and build towards the next step up." },
      { key: "shadow_bot", name: "Shadow Bot", blurb: "Create a bot from your recorded performances and see how your darts profile develops." },
      { key: "achievements", name: "Achievements", blurb: "Track league, practice and career challenges and see which targets are closest to completion." },
      { key: "head_to_head", name: "Head to Head", blurb: "Compare any two players across their full meeting history before the next match." },
      { key: "community", name: "Community", blurb: "Share league moments, catch up with other players and keep the club conversation going." },
    ];
    for (const row of seedRows) {
      await db.execute(sql`
        INSERT INTO broadcast_feature_spotlights (feature_key, feature_name, blurb)
        VALUES (${row.key}, ${row.name}, ${row.blurb})
        ON CONFLICT (feature_key) DO NOTHING
      `);
    }

    logger.info("broadcast_feature_spotlights ready");
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to create broadcast_feature_spotlights");
    throw err;
  }
}
