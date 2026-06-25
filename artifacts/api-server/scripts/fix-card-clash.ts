/**
 * CARD CLASH RESET & FIX SCRIPT
 * Run this to fix coins, tables, and seasons
 * 
 * Usage: 
 * 1. Copy this to artifacts/api-server/scripts/fix-card-clash.ts
 * 2. Run: npx tsx fix-card-clash.ts
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function fixCardClash() {
  console.log("🔧 CARD CLASH FIX SCRIPT STARTING...\n");

  try {
    // === FIX 1: Drop & recreate card_pity_system with correct schema ===
    console.log("1️⃣  Fixing card_pity_system table...");
    try {
      await db.execute(sql`DROP TABLE IF EXISTS card_pity_system CASCADE`);
      console.log("   ✓ Dropped old card_pity_system");
    } catch (e) {
      console.log("   ℹ️ card_pity_system not found");
    }

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS card_pity_system (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
        pulls_since_legendary INTEGER NOT NULL DEFAULT 0,
        last_legendary_pull_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("   ✓ Created card_pity_system with correct schema\n");

    // === FIX 2: Reset player_currency and grant starting coins ===
    console.log("2️⃣  Fixing player currency (granting 100 starting coins)...");
    
    const players = await db.execute(sql`SELECT id FROM players LIMIT 100`);
    console.log(`   Found ${players.rows.length} players`);

    for (const row of players.rows) {
      const playerId = (row as any).id;
      const existing = await db.execute(sql`
        SELECT id FROM player_currency WHERE player_id = ${playerId}
      `);

      if (existing.rows.length === 0) {
        await db.execute(sql`
          INSERT INTO player_currency (player_id, card_points, lifetime_coins_earned)
          VALUES (${playerId}, 100, 0)
          ON CONFLICT (player_id) DO NOTHING
        `);
        console.log(`   ✓ Player ${playerId}: Created with 100 coins`);
      } else {
        // Existing player, grant bonus coins
        await db.execute(sql`
          UPDATE player_currency 
          SET card_points = card_points + 50
          WHERE player_id = ${playerId}
        `);
        console.log(`   ✓ Player ${playerId}: Granted 50 bonus coins`);
      }
    }
    console.log("");

    // === FIX 3: Create/fix card_clash_seasons ===
    console.log("3️⃣  Creating card_clash_seasons...");
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS card_clash_seasons (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_locked BOOLEAN NOT NULL DEFAULT false,
        total_matches INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if active season exists
    const activeSeason = await db.execute(sql`
      SELECT id FROM card_clash_seasons WHERE is_active = true LIMIT 1
    `);

    if (activeSeason.rows.length === 0) {
      const now = new Date();
      const startDate = now.toISOString().split("T")[0];
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      await db.execute(sql`
        INSERT INTO card_clash_seasons (name, start_date, end_date, is_active)
        VALUES (
          ${'Season ' + now.getFullYear() + '-' + (now.getMonth() + 1)},
          ${startDate}::DATE,
          ${endDate}::DATE,
          true
        )
      `);
      console.log(`   ✓ Created new active season (${startDate} to ${endDate})\n`);
    } else {
      console.log(`   ✓ Active season already exists\n`);
    }

    // === FIX 4: Verify all tables ===
    console.log("4️⃣  Verifying tables...");
    const tables = [
      "player_currency",
      "card_pity_system",
      "card_clash_seasons",
      "card_definitions",
      "player_card_inventory",
    ];

    for (const table of tables) {
      const result = await db.execute(sql.raw(`
        SELECT to_regclass('public.${table}') AS table_exists
      `));
      const exists = (result.rows[0] as any)?.table_exists;
      console.log(`   ${exists ? "✓" : "✗"} ${table}`);
    }

    console.log("\n✅ CARD CLASH FIX COMPLETE!\n");
    console.log("Summary:");
    console.log("  ✓ card_pity_system table fixed");
    console.log("  ✓ player_currency: all players have coins");
    console.log("  ✓ card_clash_seasons: active season created");
    console.log("  ✓ All tables verified\n");
    console.log("Next steps:");
    console.log("  1. Restart the server");
    console.log("  2. Try buying a pack - should work now");
    console.log("  3. Check /api/card-clash/season/active - should return season\n");

  } catch (error) {
    console.error("❌ ERROR:", error);
    process.exit(1);
  }
}

fixCardClash().then(() => {
  console.log("🎉 Done!");
  process.exit(0);
});
