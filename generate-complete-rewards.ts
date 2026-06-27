/**
 * COMPLETE ACHIEVEMENT REWARDS GENERATOR
 * Queries database for ALL achievements and creates universal mapping
 * 
 * Usage: npx ts-node generate-complete-rewards.ts
 */

import { db, achievementsTable } from "@workspace/db";

async function generateCompleteRewards() {
  console.log("🔍 Querying database for ALL achievements...\n");

  // Get ALL achievements from database
  const allAchievements = await db
    .select({
      key: achievementsTable.key,
      name: achievementsTable.name,
      rarity: achievementsTable.rarity,
      category: achievementsTable.category,
      coinReward: achievementsTable.coinReward,
      packReward: achievementsTable.packReward,
    })
    .from(achievementsTable)
    .orderBy(achievementsTable.key);

  console.log(`✅ Found ${allAchievements.length} total achievements\n`);

  // Group by category
  const byCategory: Record<string, typeof allAchievements> = {};
  allAchievements.forEach((a) => {
    if (!byCategory[a.category]) byCategory[a.category] = [];
    byCategory[a.category].push(a);
  });

  // Print summary
  console.log("📊 ACHIEVEMENTS BY CATEGORY:\n");
  Object.entries(byCategory)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([category, achs]) => {
      console.log(`  ${category}: ${achs.length}`);
    });

  // Group by rarity
  const byRarity: Record<string, typeof allAchievements> = {};
  allAchievements.forEach((a) => {
    if (!byRarity[a.rarity]) byRarity[a.rarity] = [];
    byRarity[a.rarity].push(a);
  });

  console.log("\n💎 ACHIEVEMENTS BY RARITY:\n");
  Object.entries(byRarity)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([rarity, achs]) => {
      console.log(`  ${rarity}: ${achs.length}`);
    });

  // Verify all have rewards
  const withoutRewards = allAchievements.filter((a) => !a.coinReward);
  if (withoutRewards.length > 0) {
    console.log(
      `\n⚠️  WARNING: ${withoutRewards.length} achievements missing coin rewards!`
    );
    withoutRewards.slice(0, 5).forEach((a) => {
      console.log(`   - ${a.key}: ${a.name}`);
    });
  }

  // Generate TypeScript constant
  let tsCode = `// COMPLETE ACHIEVEMENT REWARDS MAPPING
// Auto-generated from database - DO NOT EDIT MANUALLY
// ${allAchievements.length} achievements total

export const ACHIEVEMENT_REWARDS: Record<
  string,
  { coinReward?: number; packReward?: 'SINGLE' | 'FIVE' | 'TEN' }
> = {
`;

  allAchievements.forEach((a) => {
    const coins = a.coinReward ?? 0;
    const pack = a.packReward;

    if (pack) {
      tsCode += `  ${a.key}: { coinReward: ${coins}, packReward: "${pack}" },\n`;
    } else {
      tsCode += `  ${a.key}: { coinReward: ${coins} },\n`;
    }
  });

  tsCode += `};

export function getAchievementReward(
  achievementKey: string
): { coinReward?: number; packReward?: 'SINGLE' | 'FIVE' | 'TEN' } {
  return ACHIEVEMENT_REWARDS[achievementKey] || {};
}

export function formatPackReward(packReward?: 'SINGLE' | 'FIVE' | 'TEN'): string {
  if (!packReward) return 'None';
  if (packReward === 'SINGLE') return '1 Pack';
  if (packReward === 'FIVE') return '5-Pack';
  if (packReward === 'TEN') return '10-Pack';
  return 'Unknown';
}
`;

  console.log("\n\n✨ GENERATED TypeScript:\n");
  console.log(tsCode);

  console.log(
    "\n📝 Copy this to: artifacts/tkdl/src/utils/achievement-rewards.ts\n"
  );

  process.exit(0);
}

generateCompleteRewards().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
