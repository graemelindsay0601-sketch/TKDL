import type { Player, Match } from "@workspace/db";

export type NarrativeType =
  | "HOTTEST_PLAYER"
  | "TITLE_RACE"
  | "ELIMINATION_WATCH"
  | "STREAK_WATCH"
  | "RECENT_UPSET"
  | "LEAGUE_STATE"
  | "MOST_DANGEROUS";

export type NarrativeCard = {
  type: NarrativeType;
  headline: string;
  body: string;
  priority: number;
  playerIds: number[];
  icon: string;
};

export function buildNarrativeCards(
  players: Player[],
  recentMatches: Match[]
): NarrativeCard[] {
  const active = players.filter(p => p.isActive);
  const leaderboard = [...active].sort((a, b) => b.points - a.points || b.elo - a.elo);
  const cards: NarrativeCard[] = [];

  // HOTTEST PLAYER — longest active win streak
  const hottest = [...leaderboard]
    .filter(p => p.currentWinStreak >= 2 && p.status === "ACTIVE")
    .sort((a, b) => b.currentWinStreak - a.currentWinStreak)[0];
  if (hottest) {
    cards.push({
      type: "HOTTEST_PLAYER",
      headline: `🔥 ${hottest.name} is on fire`,
      body: `${hottest.currentWinStreak} wins in a row — ${hottest.name} is the hottest player in the league right now.`,
      priority: 90,
      playerIds: [hottest.id],
      icon: "🔥",
    });
  }

  // ELIMINATION WATCH — players with ≤ 8 points
  const atRisk = leaderboard.filter(p => p.points <= 8 && p.status === "ACTIVE");
  if (atRisk.length > 0) {
    const names = atRisk.map(p => p.name).join(", ");
    cards.push({
      type: "ELIMINATION_WATCH",
      headline: `☠ Elimination Watch`,
      body: `${names} ${atRisk.length === 1 ? "is" : "are"} on the edge — one bad wager from elimination.`,
      priority: 95,
      playerIds: atRisk.map(p => p.id),
      icon: "☠",
    });
  }

  // TITLE RACE — top 3 active within striking distance
  const top3 = leaderboard.filter(p => p.status === "ACTIVE").slice(0, 3);
  if (top3.length >= 2) {
    const gap = top3[0].points - (top3[top3.length - 1]?.points ?? 0);
    if (gap <= 18) {
      cards.push({
        type: "TITLE_RACE",
        headline: `👑 Title race is live`,
        body: `${top3[0].name} leads with ${top3[0].points} pts, but ${top3[1].name} is only ${top3[0].points - top3[1].points} behind. Season wide open.`,
        priority: 80,
        playerIds: top3.map(p => p.id),
        icon: "👑",
      });
    }
  }

  // COLD STREAK — anyone on loss streak ≥ 2
  const coldStreak = leaderboard
    .filter(p => p.currentLossStreak >= 2 && p.status === "ACTIVE")
    .sort((a, b) => b.currentLossStreak - a.currentLossStreak)[0];
  if (coldStreak) {
    cards.push({
      type: "STREAK_WATCH",
      headline: `❄ ${coldStreak.name}'s nightmare run`,
      body: `${coldStreak.name} has dropped ${coldStreak.currentLossStreak} in a row and ${coldStreak.points <= 8 ? "is on the brink of elimination" : "is losing ground fast"}.`,
      priority: 70,
      playerIds: [coldStreak.id],
      icon: "❄",
    });
  }

  // MOST DANGEROUS — high points winner from recent matches
  const highStakeMatch = [...recentMatches]
    .filter(m => m.stake >= 10)
    .sort((a, b) => b.stake - a.stake)[0];
  if (highStakeMatch) {
    const winner = players.find(p => p.id === highStakeMatch.winnerId);
    if (winner) {
      cards.push({
        type: "MOST_DANGEROUS",
        headline: `💰 ${winner.name} playing with fire`,
        body: `${winner.name} wagered ${highStakeMatch.stake} points in a recent match — and won. High stakes, higher rewards.`,
        priority: 65,
        playerIds: [winner.id],
        icon: "💰",
      });
    }
  }

  // RECENT UPSET — lower-ranked player beat higher-ranked
  if (recentMatches.length >= 2) {
    for (const m of recentMatches.slice(0, 5)) {
      const winner = active.find(p => p.id === m.winnerId);
      const loser  = active.find(p => p.id === m.loserId);
      if (winner && loser && loser.points > winner.points + 10) {
        cards.push({
          type: "RECENT_UPSET",
          headline: `⚡ Upset alert`,
          body: `${winner.name} defeated ${loser.name} despite trailing by ${loser.points - winner.points} pts. The league is unpredictable.`,
          priority: 60,
          playerIds: [winner.id, loser.id],
          icon: "⚡",
        });
        break;
      }
    }
  }

  // Fallback — league state
  if (cards.length === 0) {
    const leader = leaderboard[0];
    if (leader) {
      cards.push({
        type: "LEAGUE_STATE",
        headline: `⚡ ${leader.name} leads the pack`,
        body: `${leader.name} holds the top spot with ${leader.points} pts. The season is taking shape.`,
        priority: 50,
        playerIds: [leader.id],
        icon: "⚡",
      });
    }
  }

  return cards.sort((a, b) => b.priority - a.priority);
}
