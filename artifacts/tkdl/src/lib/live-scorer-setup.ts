export type WagerAccount = { name: string; points: number; weight: number };

/** Team membership determines the wallet; singles standings never supply it. */
export function teamRoster<T extends { id: number; name: string; status: string; points: number; elo: number }>(
  players: T[], team: { name: string; points: number; elo?: number; players: { id: number }[] } | null,
) {
  if (!team) return [];
  return players.filter(p => p.status !== "INACTIVE" && team.players.some(member => member.id === p.id))
    .map(p => ({ ...p, points: team.points, elo: team.elo ?? 0, balanceName: team.name }));
}

/** Integer shares, with ties awarded in the displayed roster order. */
export function wagerShares(pot: number, accounts: readonly WagerAccount[]): number[] {
  const total = accounts.reduce((sum, a) => sum + a.weight, 0);
  if (total <= 0) return accounts.map(() => 0);
  const raw = accounts.map(a => pot * a.weight / total);
  const shares = raw.map(Math.floor);
  const order = raw.map((n, i) => ({ i, fraction: n - shares[i] })).sort((a, b) => b.fraction - a.fraction);
  const remainder = pot - shares.reduce((sum, n) => sum + n, 0);
  for (let i = 0; i < remainder; i++) shares[order[i].i]++;
  return shares;
}

export function totalWagerError(pot: number, sides: readonly WagerAccount[][]): string {
  if (!Number.isSafeInteger(pot) || pot < 1) return "Enter a whole-number total wager of at least 1pt";
  for (const side of sides) {
    const shares = wagerShares(pot, side);
    for (let i = 0; i < side.length; i++) {
      if (shares[i] > side[i].points) return `${side[i].name} would owe ${shares[i]}pts but has ${side[i].points}pts`;
    }
  }
  return "";
}

export function validCombinedSelection(soloId: string, firstId: string, extraIds: string[], picks: Record<string, string[]>, roster: (id: string) => { id: number }[]): boolean {
  const teamIds = [soloId, firstId, ...extraIds];
  if (extraIds.length === 0 || teamIds.some(id => !id) || new Set(teamIds).size !== teamIds.length) return false;
  return extraIds.every(id => {
    const ids = picks[id] ?? [];
    return ids.length >= 1 && ids.length <= 6 && new Set(ids).size === ids.length
      && ids.every(pid => roster(id).some(p => String(p.id) === pid));
  });
}
