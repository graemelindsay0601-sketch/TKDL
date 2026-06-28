import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export async function up() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS card_clash_favorites (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
      card_id VARCHAR(50) NOT NULL,
      card_name VARCHAR(100),
      game_mode VARCHAR(20) NOT NULL DEFAULT 'X01',
      added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(player_id, card_id, game_mode)
    );
  `);

  // Create index for faster lookups
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_card_clash_favorites_player 
    ON card_clash_favorites(player_id, game_mode);
  `);

  await client.end();
}

export async function down() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  await db.execute(sql`DROP TABLE IF EXISTS card_clash_favorites CASCADE;`);
  await client.end();
}
