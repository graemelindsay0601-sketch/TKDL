export type DoublesCandidate = { id: number };

export type PreviousTriple = {
  seasonId: number;
  player1Id: number;
  player2Id: number;
  player3Id: number;
};

type TripleRecord = { appearances: number; lastSeasonId: number };

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swapWith = Math.floor(random() * (index + 1));
    [result[index], result[swapWith]] = [result[swapWith], result[index]];
  }
  return result;
}

/**
 * Makes random pairs while sharing the three-player-team duty fairly when
 * the roster is odd. Fewer past triple appearances wins first; among equal
 * counts, the player who has gone longest without one is preferred. A random
 * tie-break keeps a brand-new or equally balanced league feeling like a draw.
 */
export function buildFairDoublesGroups<T extends DoublesCandidate>(
  candidates: readonly T[],
  previousTriples: readonly PreviousTriple[],
  random: () => number = Math.random,
): T[][] {
  if (candidates.length < 2) return [];

  let triple: T[] = [];
  let pairPool = [...candidates];

  if (candidates.length % 2 === 1) {
    const records = new Map<number, TripleRecord>();
    for (const row of previousTriples) {
      for (const playerId of [row.player1Id, row.player2Id, row.player3Id]) {
        const current = records.get(playerId) ?? { appearances: 0, lastSeasonId: 0 };
        records.set(playerId, {
          appearances: current.appearances + 1,
          lastSeasonId: Math.max(current.lastSeasonId, row.seasonId),
        });
      }
    }

    const ranked = candidates
      .map(player => ({
        player,
        record: records.get(player.id) ?? { appearances: 0, lastSeasonId: 0 },
        randomOrder: random(),
      }))
      .sort((left, right) =>
        left.record.appearances - right.record.appearances
        || left.record.lastSeasonId - right.record.lastSeasonId
        || left.randomOrder - right.randomOrder
      );

    triple = shuffled(ranked.slice(0, 3).map(entry => entry.player), random);
    const tripleIds = new Set(triple.map(player => player.id));
    pairPool = candidates.filter(player => !tripleIds.has(player.id));
  }

  const shuffledPairs = shuffled(pairPool, random);
  const groups: T[][] = [];
  for (let index = 0; index < shuffledPairs.length; index += 2) {
    groups.push([shuffledPairs[index], shuffledPairs[index + 1]]);
  }

  if (triple.length > 0) {
    // Put the triple at a random point in the reveal order so the fair
    // selection still lands as a draw-night surprise.
    groups.splice(Math.floor(random() * (groups.length + 1)), 0, triple);
  }

  return groups;
}
