/**
 * Migration: Add times_purchased column to player_cards
 * 
 * Tracks how many times each individual card has been purchased by a player.
 * This allows displaying purchase history in the card shop.
 */

export async function up(db: any) {
  try {
    // Add times_purchased integer column with default 0
    await db.schema.table('player_cards', (table: any) => {
      table.integer('times_purchased').defaultTo(0).unsigned();
    });

    console.log('✅ Added times_purchased column to player_cards');
  } catch (err) {
    console.error('❌ Error adding times_purchased:', err);
    throw err;
  }
}

export async function down(db: any) {
  try {
    // Rollback: drop column
    await db.schema.table('player_cards', (table: any) => {
      table.dropColumn('times_purchased');
    });

    console.log('✅ Removed times_purchased column from player_cards');
  } catch (err) {
    console.error('❌ Error removing times_purchased:', err);
    throw err;
  }
}
