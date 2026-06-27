/**
 * Migration: Add purchase_date to player_cards
 * 
 * Tracks when each player acquired each card
 * Allows historical card collection viewing
 * Supports "New" badge for recently acquired cards
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Check if column already exists
  const hasColumn = await knex.schema.hasColumn('player_cards', 'purchase_date');

  if (!hasColumn) {
    await knex.schema.alterTable('player_cards', (table) => {
      // Add purchase_date column with default to current time for existing rows
      table.timestamp('purchase_date').notNullable().defaultTo(knex.fn.now());
    });

    console.log('✅ Added purchase_date column to player_cards');
  } else {
    console.log('⚠️  purchase_date column already exists');
  }
}

export async function down(knex: Knex): Promise<void> {
  // Rollback: remove the column
  await knex.schema.alterTable('player_cards', (table) => {
    table.dropColumn('purchase_date');
  });

  console.log('✅ Removed purchase_date column from player_cards');
}
