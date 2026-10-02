export type WhatIfRow = { id: number; name: string; points: number; elo?: number; eliminated?: boolean };
export type WhatIfOutcome = { winnerId: number; loserId: number; rows: WhatIfRow[]; winnerRank: number; loserRank: number };

export function simulateStanding(rows: WhatIfRow[], winnerId: number, loserId: number, stake: number): WhatIfOutcome | null {
  if (winnerId === loserId || !Number.isInteger(stake) || stake < 1) return null;
  const winner = rows.find(row => row.id === winnerId);
  const loser = rows.find(row => row.id === loserId);
  if (!winner || !loser || loser.points < stake) return null;
  const projected = rows.map(row => row.id === winnerId ? { ...row, points:row.points + stake } : row.id === loserId ? { ...row, points:row.points - stake, eliminated:row.points - stake <= 0 } : { ...row });
  projected.sort((a,b) => Number(a.eliminated)-Number(b.eliminated) || b.points-a.points || (b.elo ?? 0)-(a.elo ?? 0) || a.name.localeCompare(b.name));
  return { winnerId, loserId, rows:projected, winnerRank:projected.findIndex(row=>row.id===winnerId)+1, loserRank:projected.findIndex(row=>row.id===loserId)+1 };
}
