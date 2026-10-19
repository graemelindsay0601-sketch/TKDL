export type AnzLegFact = { winner: 0 | 1; firstThrow: 0 | 1 };

export function anzLegsWonAgainstThrow(legs: readonly AnzLegFact[]): [number, number] {
  const result: [number, number] = [0, 0];
  for (const leg of legs) if (leg.winner !== leg.firstThrow) result[leg.winner]++;
  return result;
}

export function anzTournamentAverage(points: number, darts: number): number | null {
  return darts > 0 ? Math.round((points / darts) * 300) / 100 : null;
}
