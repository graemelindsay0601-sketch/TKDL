/**
 * Migration: Add is_favorite column to player_cards table
 * 
 * This enables players to mark cards as favorites, which will be sorted
 * to the top of the equip screen and collection views.
 */

export async function up(db: any) {
  // Add is_favorite boolean column with default false
  await db.schema.table('player_cards', (table: any) => {
    table.boolean('is_favorite').defaultTo(false);
  });

  console.log('✅ Added is_favorite column to player_cards');
}

export async function down(db: any) {
  // Rollback
  await db.schema.table('player_cards', (table: any) => {
    table.dropColumn('is_favorite');
  });

  console.log('✅ Removed is_favorite column from player_cards');
}
