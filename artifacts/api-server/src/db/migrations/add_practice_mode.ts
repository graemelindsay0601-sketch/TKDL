/**
 * Migration: Add practice mode support to Card Clash
 * 
 * Adds flags to track:
 * - is_practice: Whether this is a practice match (not ranked)
 * - opponent_type: 'player', 'bot', 'bot_pro'
 * - reward_multiplier: Different for practice vs ranked
 */

export async function up(db: any) {
  await db.schema.table('card_clash_matches', (table: any) => {
    // Mark as practice match (doesn't affect ranking)
    table.boolean('is_practice').defaultTo(false);

    // Type of opponent
    table.enum('opponent_type', ['player', 'bot', 'bot_pro']).defaultTo('player');

    // Reward multiplier (0.5x for practice, 1x for ranked)
    table.float('reward_multiplier').defaultTo(1);

    // For practice matches, store the match result message
    table.text('practice_notes').nullable();

    // Indexing for faster queries
    table.index(['is_practice', 'player_1_id', 'created_at']);
  });

  console.log('✅ Added practice mode columns to card_clash_matches');
}

export async function down(db: any) {
  await db.schema.table('card_clash_matches', (table: any) => {
    table.dropColumn('is_practice');
    table.dropColumn('opponent_type');
    table.dropColumn('reward_multiplier');
    table.dropColumn('practice_notes');
    table.dropIndex(['is_practice', 'player_1_id', 'created_at']);
  });

  console.log('✅ Removed practice mode columns from card_clash_matches');
}
